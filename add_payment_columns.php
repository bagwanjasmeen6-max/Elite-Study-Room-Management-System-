<?php
declare(strict_types=1);

require __DIR__ . '/../api/db.php';

header('Content-Type: text/plain');

try {
    $pdo = db();
    ensure_schema($pdo);
    echo "Database schema is ready. Payment columns are available.\n";
} catch (Throwable $error) {
    http_response_code(500);
    echo "Database setup failed: " . $error->getMessage() . "\n";
}
