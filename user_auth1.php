<?php
declare(strict_types=1);

header('Content-Type: application/json');
session_start();
require __DIR__ . '/db1.php';

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function request_body(): array
{
    if (!empty($_POST)) {
        return $_POST;
    }

    $raw = file_get_contents('php://input') ?: '{}';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function current_user_payload(): ?array
{
    if (!isset($_SESSION['elite_user']) || !is_array($_SESSION['elite_user'])) {
        return null;
    }
    return $_SESSION['elite_user'];
}

function store_user_session(array $user): void
{
    $_SESSION['elite_user'] = [
        'id' => (string) $user['id'],
        'fullName' => (string) $user['full_name'],
        'phone' => (string) $user['phone'],
        'email' => (string) $user['email'],
        'location' => (string) $user['location'],
    ];
}

try {
    $pdo = db();
    $action = $_GET['action'] ?? ($_POST['action'] ?? 'session');

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'session') {
        respond(['ok' => true, 'user' => current_user_payload()]);
    }

    $data = request_body();
    $action = $data['action'] ?? $action;

    if ($action === 'logout') {
        $_SESSION = [];
        session_destroy();
        respond(['ok' => true]);
    }

    if ($action === 'register') {
        $fullName = trim((string) ($data['fullName'] ?? ''));
        $phone = trim((string) ($data['phone'] ?? ''));
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        $password = (string) ($data['password'] ?? '');
        $location = trim((string) ($data['location'] ?? ''));

        if ($fullName === '' || $phone === '' || $email === '' || $password === '' || $location === '') {
            respond(['ok' => false, 'error' => 'Please fill all registration fields.'], 422);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respond(['ok' => false, 'error' => 'Please enter a valid email address.'], 422);
        }
        if (strlen($password) < 6) {
            respond(['ok' => false, 'error' => 'Password must be at least 6 characters.'], 422);
        }
        if (!in_array($location, ['Pune', 'Kolhapur', 'Sangli', 'Satara'], true)) {
            respond(['ok' => false, 'error' => 'Please choose a valid location.'], 422);
        }

        $check = $pdo->prepare("SELECT COUNT(*) FROM users WHERE phone = ? OR email = ?");
        $check->execute([$phone, $email]);
        if ((int) $check->fetchColumn() > 0) {
            respond(['ok' => false, 'error' => 'User already exists with this phone or email.'], 409);
        }

        $id = 'user-' . time() . '-' . random_int(1000, 9999);
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $insert = $pdo->prepare("INSERT INTO users (id, full_name, phone, email, password_hash, location, active) VALUES (?, ?, ?, ?, ?, ?, 1)");
        $insert->execute([$id, $fullName, $phone, $email, $hash, $location]);

        $user = [
            'id' => $id,
            'full_name' => $fullName,
            'phone' => $phone,
            'email' => $email,
            'location' => $location,
        ];
        session_regenerate_id(true);
        store_user_session($user);
        respond(['ok' => true, 'user' => current_user_payload()]);
    }

    if ($action === 'login') {
        $login = strtolower(trim((string) ($data['login'] ?? '')));
        $password = (string) ($data['password'] ?? '');
        if ($login === '' || $password === '') {
            respond(['ok' => false, 'error' => 'Please enter login and password.'], 422);
        }

        $stmt = $pdo->prepare("SELECT id, full_name, phone, email, password_hash, location, active FROM users WHERE email = :login OR phone = :login LIMIT 1");
        $stmt->execute(['login' => $login]);
        $user = $stmt->fetch();

        if (!$user || (int) $user['active'] !== 1 || !password_verify($password, (string) $user['password_hash'])) {
            respond(['ok' => false, 'error' => 'Invalid user credentials.'], 401);
        }

        session_regenerate_id(true);
        store_user_session($user);
        respond(['ok' => true, 'user' => current_user_payload()]);
    }

    respond(['ok' => false, 'error' => 'Unknown action.'], 400);
} catch (Throwable $error) {
    respond(['ok' => false, 'error' => $error->getMessage()], 500);
}