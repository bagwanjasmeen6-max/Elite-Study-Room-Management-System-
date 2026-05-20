<?php
declare(strict_types=1);

header('Content-Type: application/json');
require __DIR__ . '/db1.php';

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function body(): array
{
    $raw = file_get_contents('php://input') ?: '{}';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function ensurePaymentsTable(PDO $pdo): void
{
    // Safe fallback: create payments table if it doesn't exist.
    $sql = "CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(100) PRIMARY KEY,
        booking_id VARCHAR(100) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        method VARCHAR(30) NOT NULL,
        transaction_ref VARCHAR(120) NOT NULL,
        status ENUM('paid','failed') NOT NULL DEFAULT 'paid',
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_payments_booking (booking_id)
    )";

    $pdo->exec($sql);
}

function getBooking(PDO $pdo, string $bookingId): ?array
{
    $stmt = $pdo->prepare(
        "SELECT id, user_name AS userName, phone, email, room_id AS roomId, room_name AS roomName,
                slot_id AS slotId, slot_label AS slotLabel, seat_id AS seatId, seat_label AS seatLabel,
                booking_date AS date, amount, payment_method AS paymentMethod,
                payment_reference AS paymentReference, status
         FROM bookings WHERE id = :id"
    );
    $stmt->execute(['id' => $bookingId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function defaultRoomPrice(string $roomId): float
{
    $prices = [
        'switch-desk' => 120.0,
        'pc-desk' => 180.0,
        'group-table' => 150.0,
        'board-room' => 500.0,
    ];

    return $prices[$roomId] ?? 0.0;
}

function bookingAmount(PDO $pdo, array $booking): float
{
    $amount = (float)($booking['amount'] ?? 0);
    if ($amount > 0) return $amount;

    $priceStmt = $pdo->prepare("SELECT price FROM rooms WHERE id = :roomId");
    $priceStmt->execute(['roomId' => (string)($booking['roomId'] ?? '')]);
    $price = $priceStmt->fetchColumn();
    if ($price !== false && (float)$price > 0) return (float)$price;

    return defaultRoomPrice((string)($booking['roomId'] ?? ''));
}

function receiptToken(string $bookingId): string
{
    $clean = preg_replace('/[^A-Za-z0-9]/', '', $bookingId) ?: $bookingId;
    return strtoupper(substr($clean, -8));
}

try {
    $pdo = db();
    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? '';

    $data = body();

    if ($action === 'pay') {
        if ($method !== 'POST') {
            respond(['ok' => false, 'error' => 'Method not allowed'], 405);
        }

        $bookingId = (string)($data['bookingId'] ?? '');
        $amountNum = (float)($data['amount'] ?? 0);
        $methodName = (string)($data['method'] ?? 'upi');
        $transactionRef = 'AUTO-' . strtoupper(bin2hex(random_bytes(4)));

        if ($bookingId === '') {
            respond(['ok' => false, 'error' => 'bookingId is required'], 400);
        }

        $booking = getBooking($pdo, $bookingId);
        if (!$booking) {
            respond(['ok' => false, 'error' => 'Booking not found'], 404);
        }

        $bookingStatus = strtolower((string)($booking['status'] ?? ''));
        if (in_array($bookingStatus, ['rejected', 'cancelled'], true)) {
            respond(['ok' => false, 'error' => 'This booking cannot be paid'], 409);
        }

        if ($bookingStatus === 'paid') {
            respond(['ok' => true, 'alreadyPaid' => true]);
        }

        if ($amountNum <= 0) {
            $amountNum = bookingAmount($pdo, $booking);
        }

        if ($amountNum <= 0) {
            respond(['ok' => false, 'error' => 'Amount must be greater than 0'], 400);
        }

        ensurePaymentsTable($pdo);

        $paymentId = 'pay-' . $bookingId . '-' . date('YmdHis');

        $pdo->beginTransaction();
        try {
            $insert = $pdo->prepare(
                "INSERT INTO payments (id, booking_id, amount, method, transaction_ref, status)
                 VALUES (:id, :bookingId, :amount, :method, :tx, 'paid')"
            );
            $insert->execute([
                'id' => $paymentId,
                'bookingId' => $bookingId,
                'amount' => $amountNum,
                'method' => $methodName,
                'tx' => $transactionRef,
            ]);

            $upd = $pdo->prepare(
                "UPDATE bookings
                 SET amount = :amount,
                     payment_method = :method,
                     payment_reference = :tx,
                     payment_status = 'paid',
                     paid_at = NOW(),
                     receipt_token = COALESCE(receipt_token, :receiptToken),
                     status = 'paid'
                 WHERE id = :id"
            );
            $upd->execute([
                'id' => $bookingId,
                'amount' => $amountNum,
                'method' => $methodName,
                'tx' => $transactionRef,
                'receiptToken' => receiptToken($bookingId),
            ]);

            $pdo->commit();
            respond(['ok' => true, 'paymentId' => $paymentId, 'amount' => $amountNum]);
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    if ($action === 'receipt') {
        if ($method !== 'GET') {
            respond(['ok' => false, 'error' => 'Method not allowed'], 405);
        }

        $bookingId = (string)($_GET['bookingId'] ?? '');
        if ($bookingId === '') {
            respond(['ok' => false, 'error' => 'bookingId is required'], 400);
        }

        $booking = getBooking($pdo, $bookingId);
        if (!$booking) {
            respond(['ok' => false, 'error' => 'Booking not found'], 404);
        }

        respond([
            'ok' => true,
            'receipt' => [
                'bookingId' => $booking['id'],
                'receiptToken' => receiptToken((string)$booking['id']),
                'userName' => $booking['userName'],
                'phone' => $booking['phone'],
                'email' => $booking['email'],
                'roomName' => $booking['roomName'],
                'seatLabel' => $booking['seatLabel'],
                'slotLabel' => $booking['slotLabel'],
                'date' => $booking['date'],
                'amount' => bookingAmount($pdo, $booking),
                'method' => $booking['paymentMethod'] ?? '',
                'transactionRef' => $booking['paymentReference'] ?? '',
                'status' => $booking['status']
            ]
        ]);
    }

    respond(['ok' => false, 'error' => 'Unknown action'], 400);
} catch (Throwable $e) {
    respond(['ok' => false, 'error' => 'Payment failed', 'details' => $e->getMessage()], 500);
}
