<?php
declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=UTF-8');

$recipientEmail = 'soul-abducter@yandex.ru'; // !!! ЗАМЕНИТЕ ЭТОТ АДРЕС НА СВОЙ !!!
const SUBMISSION_COOLDOWN_SECONDS = 60;
const SENDER_EMAIL = 'noreply@yourdomain.com'; // Замените на реальный адрес домена

if (!function_exists('str_starts_with')) {
    function str_starts_with(string $haystack, string $needle): bool
    {
        return $needle === '' || strncmp($haystack, $needle, strlen($needle)) === 0;
    }
}

const MESSAGES = [
    'fields_required' => [
        'ru' => 'Пожалуйста, заполните все обязательные поля.',
        'en' => 'Please fill in all required fields.',
    ],
    'invalid_recipient' => [
        'ru' => 'Неверно указан email получателя в конфигурации.',
        'en' => 'Recipient email address is not configured correctly.',
    ],
    'invalid_email' => [
        'ru' => 'Укажите корректный email.',
        'en' => 'Please provide a valid email address.',
    ],
    'invalid_name' => [
        'ru' => 'Имя содержит недопустимые символы.',
        'en' => 'The name contains invalid characters.',
    ],
    'invalid_phone' => [
        'ru' => 'Пожалуйста, укажите корректный номер телефона.',
        'en' => 'Please provide a valid phone number.',
    ],
    'cooldown' => [
        'ru' => 'Подождите {seconds} с перед повторной отправкой.',
        'en' => 'Please wait {seconds}s before sending again.',
    ],
    'success' => [
        'ru' => 'Спасибо, ваша заявка отправлена!',
        'en' => 'Thank you, your request has been sent!',
    ],
    'send_error' => [
        'ru' => 'Не удалось отправить письмо. Пожалуйста, попробуйте позже.',
        'en' => 'Unable to send the message. Please try again later.',
    ],
    'method_not_allowed' => [
        'ru' => 'Неверный метод запроса.',
        'en' => 'Invalid request method.',
    ],
];

function translate(string $key, string $lang): string
{
    return MESSAGES[$key][$lang] ?? MESSAGES[$key]['ru'] ?? '';
}

function normalizePhone(string $value): string
{
    $trimmed = trim($value);
    if ($trimmed === '') {
        return '';
    }

    $digits = preg_replace('/\D+/', '', $trimmed);
    if ($digits === '') {
        return '';
    }

    if (str_starts_with($trimmed, '+')) {
        return '+' . $digits;
    }

    if (str_starts_with($digits, '8') && strlen($digits) === 11) {
        return '+7' . substr($digits, 1);
    }

    if (str_starts_with($digits, '7') && strlen($digits) === 11) {
        return '+' . $digits;
    }

    return '+' . $digits;
}

function jsonResponse(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => translate('method_not_allowed', 'ru')], 405);
}

mb_internal_encoding('UTF-8');
mb_language('uni');

$lang = strtolower((string)($_POST['lang'] ?? 'ru'));
if (!in_array($lang, ['ru', 'en'], true)) {
    $lang = 'ru';
}

$honeypot = trim((string)($_POST['company'] ?? ''));
if ($honeypot !== '') {
    jsonResponse(['success' => true, 'message' => translate('success', $lang)]);
}

if (SUBMISSION_COOLDOWN_SECONDS > 0) {
    $lastSubmission = (int)($_SESSION['apex_last_submission'] ?? 0);
    $now = time();
    if (($now - $lastSubmission) < SUBMISSION_COOLDOWN_SECONDS) {
        $secondsLeft = SUBMISSION_COOLDOWN_SECONDS - ($now - $lastSubmission);
        $message = str_replace('{seconds}', (string)$secondsLeft, translate('cooldown', $lang));
        jsonResponse(['success' => false, 'message' => $message]);
    }
}

$name = trim((string)($_POST['name'] ?? ''));
$email = trim((string)($_POST['email'] ?? ''));
$phoneRaw = trim((string)($_POST['phone'] ?? ''));
$message = trim((string)($_POST['message'] ?? ''));

if ($name === '' || $email === '' || $phoneRaw === '' || $message === '') {
    jsonResponse(['success' => false, 'message' => translate('fields_required', $lang)]);
}

if (!filter_var($recipientEmail, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['success' => false, 'message' => translate('invalid_recipient', $lang)]);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['success' => false, 'message' => translate('invalid_email', $lang)]);
}

if (preg_match('/[\r\n]/', $name)) {
    jsonResponse(['success' => false, 'message' => translate('invalid_name', $lang)]);
}

$phone = normalizePhone($phoneRaw);
if ($phone === '') {
    jsonResponse(['success' => false, 'message' => translate('invalid_phone', $lang)]);
}

$subject = 'Новая заявка с сайта APEX DRIVE';
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

$sanitizedMessage = preg_replace("/\r\n?/", "\n", $message);

$emailContent = sprintf(
    "Имя: %s\nEmail: %s\nТелефон: %s\nСообщение:\n%s\n",
    $name,
    $email,
    $phone,
    $sanitizedMessage
);

$safeNameForHeader = addcslashes($name, "\"\\");
$headers = [
    sprintf('From: %s', SENDER_EMAIL),
    sprintf('Reply-To: "%s" <%s>', $safeNameForHeader, $email),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
];

$mailSent = mail($recipientEmail, $encodedSubject, $emailContent, implode("\r\n", $headers));

if ($mailSent) {
    $_SESSION['apex_last_submission'] = time();
    jsonResponse(['success' => true, 'message' => translate('success', $lang)]);
}

jsonResponse(['success' => false, 'message' => translate('send_error', $lang)]);
