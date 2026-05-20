<?php
declare(strict_types=1);

$DB_HOST = '127.0.0.1';
$DB_NAME = 'elite_study_room';
$DB_USER = 'root';
$DB_PASS = '';

declare(strict_types=1);

header('Content-Type: application/json');
session_start();

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function request_body(): array
{
    $raw = file_get_contents('php://input') ?: '{}';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['ok' => false, 'error' => 'Only POST requests are allowed.'], 405);
}

$data = request_body();
$action = (string) ($data['action'] ?? 'login');

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    respond(['ok' => true, 'message' => 'Logged out.']);
}

$adminId = trim((string) ($data['adminId'] ?? ''));
$password = (string) ($data['password'] ?? '');

$validAdminId = 'aqsa';
$validPassword = 'aqsa1234';

if (hash_equals($validAdminId, $adminId) && hash_equals($validPassword, $password)) {
    session_regenerate_id(true);
    $_SESSION['elite_admin_logged_in'] = true;
    respond([
        'ok' => true,
        'message' => 'Access granted.',
        'redirect' => './admin_dashboard.html',
    ]);
}

respond(['ok' => false, 'error' => 'Invalid admin credentials.'], 401);
