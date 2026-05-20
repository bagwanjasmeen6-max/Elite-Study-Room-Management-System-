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

// NOTE: Payment integration is implemented in api/payment_api.php


function seed_defaults(PDO $pdo): void
{
    $rooms = [
        ['switch-desk', 'Switch System Desk', 'Individual Desk', 10, 120, 'S'],
        ['pc-desk', 'PC Desk', 'Computer Desk', 10, 180, 'PC'],
        ['group-table', 'Group Table', 'Student Group Seat', 10, 150, 'G'],
        ['board-room', 'Board Room', 'Private Room', 2, 500, 'BR'],
    ];

    $roomSql = "INSERT INTO rooms (id, name, type, capacity, price, seat_prefix, active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE name=VALUES(name), type=VALUES(type), capacity=VALUES(capacity), price=VALUES(price), seat_prefix=VALUES(seat_prefix), active=1";
    $roomStmt = $pdo->prepare($roomSql);
    foreach ($rooms as $room) {
        $roomStmt->execute($room);
    }

    $slots = [
        ['morning', 'Morning', '06:00:00', '10:00:00'],
        ['midday', 'Midday', '10:00:00', '14:00:00'],
        ['evening', 'Evening', '14:00:00', '18:00:00'],
        ['night', 'Night', '18:00:00', '22:00:00'],
        ['full-day', 'Full Day', '06:00:00', '22:00:00'],
    ];

    $slotSql = "INSERT INTO slots (id, label, start_time, end_time, active)
        VALUES (?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE label=VALUES(label), start_time=VALUES(start_time), end_time=VALUES(end_time), active=1";
    $slotStmt = $pdo->prepare($slotSql);
    foreach ($slots as $slot) {
        $slotStmt->execute($slot);
    }
}

function all_data(PDO $pdo): array
{
    $rooms = $pdo->query("SELECT id, name, type, capacity, price, seat_prefix AS seatPrefix, active FROM rooms WHERE active=1 ORDER BY name")->fetchAll();
    $slots = $pdo->query("SELECT id, label, LEFT(start_time, 5) AS start, LEFT(end_time, 5) AS end, active FROM slots WHERE active=1 ORDER BY start_time")->fetchAll();
    $bookings = $pdo->query("SELECT id, user_id AS userId, user_name AS userName, phone, email, location, room_id AS roomId, room_name AS roomName, slot_id AS slotId, slot_label AS slotLabel, seat_id AS seatId, seat_label AS seatLabel, booking_date AS date, notes, amount, payment_method AS paymentMethod, payment_reference AS paymentReference, payment_status AS paymentStatus, receipt_token AS receiptToken, status, source, created_at AS createdAt FROM bookings ORDER BY created_at DESC")->fetchAll();

    return ['rooms' => $rooms, 'slots' => $slots, 'bookings' => $bookings];
}

function verify_user_password(PDO $pdo, array $data): void
{
    $password = (string)($data['password'] ?? '');
    $userId = trim((string)($data['userId'] ?? ''));
    $phone = trim((string)($data['phone'] ?? ''));

    if ($password === '') {
        respond(['ok' => false, 'error' => 'Password is required to reserve a seat.'], 422);
    }

    if ($userId !== '') {
        $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = :id AND active = 1 LIMIT 1");
        $stmt->execute(['id' => $userId]);
    } else {
        $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE phone = :phone AND active = 1 LIMIT 1");
        $stmt->execute(['phone' => $phone]);
    }

    $hash = $stmt->fetchColumn();
    if (!$hash || !password_verify($password, (string)$hash)) {
        respond(['ok' => false, 'error' => 'Invalid password. Please use your login password.'], 401);
    }
}

try {
    $pdo = db();
    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? '';

    if ($method === 'GET') {
        seed_defaults($pdo);
        respond(['ok' => true, 'data' => all_data($pdo)]);
    }

    $data = body();

    if ($action === 'seed') {
        seed_defaults($pdo);
        respond(['ok' => true, 'data' => all_data($pdo)]);
    }

    if ($action === 'booking') {
        verify_user_password($pdo, $data);

        $sql = "INSERT INTO bookings (id, user_id, user_name, phone, email, location, room_id, room_name, slot_id, slot_label, seat_id, seat_label, booking_date, notes, amount, status, source)
            VALUES (:id, :userId, :userName, :phone, :email, :location, :roomId, :roomName, :slotId, :slotLabel, :seatId, :seatLabel, :date, :notes, :amount, 'pending', 'online')";
        $pdo->prepare($sql)->execute([
            'id' => $data['id'] ?? '',
            'userId' => $data['userId'] ?? null,
            'userName' => $data['userName'] ?? '',
            'phone' => $data['phone'] ?? '',
            'email' => $data['email'] ?? '',
            'location' => ($data['location'] ?? '') !== '' ? $data['location'] : null,
            'roomId' => $data['roomId'] ?? '',
            'roomName' => $data['roomName'] ?? '',
            'slotId' => $data['slotId'] ?? '',
            'slotLabel' => $data['slotLabel'] ?? '',
            'seatId' => $data['seatId'] ?? '',
            'seatLabel' => $data['seatLabel'] ?? '',
            'date' => $data['date'] ?? '',
            'notes' => $data['notes'] ?? '',
            'amount' => $data['amount'] ?? 0,
        ]);
        respond(['ok' => true]);
    }

    if ($action === 'room') {
        $sql = "INSERT INTO rooms (id, name, type, capacity, price, seat_prefix, active)
            VALUES (:id, :name, :type, :capacity, :price, :seatPrefix, 1)
            ON DUPLICATE KEY UPDATE name=VALUES(name), type=VALUES(type), capacity=VALUES(capacity), price=VALUES(price), seat_prefix=VALUES(seat_prefix), active=1";
        $pdo->prepare($sql)->execute($data);
        respond(['ok' => true]);
    }

    if ($action === 'slot') {
        $sql = "INSERT INTO slots (id, label, start_time, end_time, active)
            VALUES (:id, :label, :start, :end, 1)
            ON DUPLICATE KEY UPDATE label=VALUES(label), start_time=VALUES(start_time), end_time=VALUES(end_time), active=1";
        $pdo->prepare($sql)->execute($data);
        respond(['ok' => true]);
    }

    if ($action === 'status') {
        $stmt = $pdo->prepare("UPDATE bookings SET status = :status WHERE id = :id");
        $stmt->execute(['id' => $data['id'], 'status' => $data['status']]);
        respond(['ok' => true]);
    }

    // Backward compatible endpoint for payment completion (optional)
    if ($action === 'paid') {
        $stmt = $pdo->prepare("UPDATE bookings SET status = 'paid' WHERE id = :id");
        $stmt->execute(['id' => ($data['id'] ?? '')]);
        respond(['ok' => true]);
    }


    if ($action === 'delete') {
        $allowed = ['rooms', 'slots', 'bookings'];
        if (!in_array($data['collection'] ?? '', $allowed, true)) {
            respond(['ok' => false, 'error' => 'Invalid collection'], 400);
        }
        $stmt = $pdo->prepare("DELETE FROM {$data['collection']} WHERE id = :id");
        $stmt->execute(['id' => $data['id']]);
        respond(['ok' => true]);
    }

    respond(['ok' => false, 'error' => 'Unknown action'], 400);
} catch (Throwable $error) {
    respond(['ok' => false, 'error' => $error->getMessage()], 500);
}
