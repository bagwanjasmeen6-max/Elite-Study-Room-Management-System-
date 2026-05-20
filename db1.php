<?php
declare(strict_types=1);

$DB_HOST = '127.0.0.1';
$DB_PORT = '3307';
$DB_NAME = 'elite_study_room';
$DB_USER = 'root';
$DB_PASS = '';

function db(): PDO
{
    global $DB_HOST, $DB_PORT, $DB_NAME, $DB_USER, $DB_PASS;
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $serverDsn = "mysql:host={$DB_HOST};port={$DB_PORT};charset=utf8mb4";

    $server = new PDO($serverDsn, $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $server->exec("CREATE DATABASE IF NOT EXISTS `{$DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

    $dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME};charset=utf8mb4";

    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    ensure_schema($pdo);

    return $pdo;
}

function column_exists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
    ");
    $stmt->execute([$table, $column]);
    return (int) $stmt->fetchColumn() > 0;
}

function ensure_schema(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(100) PRIMARY KEY,
            full_name VARCHAR(160) NOT NULL,
            phone VARCHAR(30) NOT NULL UNIQUE,
            email VARCHAR(180) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            location ENUM('Pune','Kolhapur','Sangli','Satara') NOT NULL,
            active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_location (location)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS rooms (
            id VARCHAR(80) PRIMARY KEY,
            name VARCHAR(160) NOT NULL,
            type VARCHAR(160) NOT NULL,
            capacity INT NOT NULL,
            price DECIMAL(10,2) NOT NULL DEFAULT 0,
            seat_prefix VARCHAR(20) NOT NULL,
            active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS slots (
            id VARCHAR(80) PRIMARY KEY,
            label VARCHAR(120) NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS bookings (
            id VARCHAR(100) PRIMARY KEY,
            user_name VARCHAR(160) NOT NULL,
            phone VARCHAR(30) NOT NULL,
            email VARCHAR(180),
            room_id VARCHAR(80) NOT NULL,
            room_name VARCHAR(160) NOT NULL,
            slot_id VARCHAR(80) NOT NULL,
            slot_label VARCHAR(120) NOT NULL,
            seat_id VARCHAR(30) NOT NULL,
            seat_label VARCHAR(30) NOT NULL,
            booking_date DATE NOT NULL,
            notes TEXT,
            status ENUM('pending','approved','rejected','cancelled','paid') NOT NULL DEFAULT 'pending',
            source VARCHAR(40) NOT NULL DEFAULT 'online',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_booking_lookup (room_id, slot_id, booking_date, seat_id),
            INDEX idx_booking_phone (phone)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $columns = [
        'amount' => "ALTER TABLE bookings ADD COLUMN amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER notes",
        'payment_method' => "ALTER TABLE bookings ADD COLUMN payment_method ENUM('cash','upi','card','bank') NOT NULL DEFAULT 'cash' AFTER amount",
        'payment_reference' => "ALTER TABLE bookings ADD COLUMN payment_reference VARCHAR(160) AFTER payment_method",
        'payment_status' => "ALTER TABLE bookings ADD COLUMN payment_status ENUM('unpaid','pending','paid','failed','refunded') NOT NULL DEFAULT 'unpaid' AFTER payment_reference",
        'user_id' => "ALTER TABLE bookings ADD COLUMN user_id VARCHAR(100) NULL AFTER id",
        'location' => "ALTER TABLE bookings ADD COLUMN location ENUM('Pune','Kolhapur','Sangli','Satara') NULL AFTER email",
        'payment_submitted_at' => "ALTER TABLE bookings ADD COLUMN payment_submitted_at DATETIME NULL AFTER payment_status",
        'paid_at' => "ALTER TABLE bookings ADD COLUMN paid_at DATETIME NULL AFTER payment_submitted_at",
        'receipt_token' => "ALTER TABLE bookings ADD COLUMN receipt_token VARCHAR(40) NULL AFTER paid_at",
    ];

    foreach ($columns as $column => $sql) {
        if (!column_exists($pdo, 'bookings', $column)) {
            $pdo->exec($sql);
        }
    }

    $pdo->exec("
        ALTER TABLE bookings
        MODIFY status ENUM('pending','approved','rejected','cancelled','paid') NOT NULL DEFAULT 'pending'
    ");

    $indexSql = "
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'bookings'
          AND INDEX_NAME = 'idx_booking_user'
    ";
    if ((int) $pdo->query($indexSql)->fetchColumn() === 0) {
        $pdo->exec("ALTER TABLE bookings ADD INDEX idx_booking_user (user_id, booking_date)");
    }
}