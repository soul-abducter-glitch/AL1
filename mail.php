<?php
header('Content-Type: application/json');

// Ваш Email-адрес для получения заявок
$recipient_email = "ВАШ_EMAIL@example.com"; // !!! ЗАМЕНИТЕ ЭТОТ АДРЕС НА СВОЙ !!!

$response = [];

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Получение и очистка данных из формы
    $name = htmlspecialchars(trim($_POST['name'] ?? ''));
    $phone = htmlspecialchars(trim($_POST['phone'] ?? ''));
    $message = htmlspecialchars(trim($_POST['message'] ?? ''));

    // Базовая валидация
    if (empty($name) || empty($phone) || empty($message)) {
        $response = ["success" => false, "message" => "Пожалуйста, заполните все обязательные поля."];
    } else if (!filter_var($recipient_email, FILTER_VALIDATE_EMAIL)) {
        $response = ["success" => false, "message" => "Неверно указан Email получателя в скрипте."];
    } else {
        // Формирование темы и тела письма
        $subject = "Новая заявка с сайта APEX DRIVE";
        $email_content = "Имя: $name\n";
        $email_content .= "Телефон: $phone\n";
        $email_content .= "Сообщение:\n$message\n";

        // Дополнительные заголовки для письма
        $email_headers = "From: noreply@yourdomain.com\r\n"; // Замените на реальный адрес отправителя
        $email_headers .= "Reply-To: $name <$recipient_email>\r\n"; // Можно использовать email отправителя формы, если он есть
        $email_headers .= "MIME-Version: 1.0\r\n";
        $email_headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

        // Отправка письма
        if (mail($recipient_email, $subject, $email_content, $email_headers)) {
            $response = ["success" => true, "message" => "Спасибо, ваша заявка отправлена!"];
        } else {
            $response = ["success" => false, "message" => "Произошла ошибка при отправке письма. Пожалуйста, попробуйте еще раз."];
        }
    }
} else {
    $response = ["success" => false, "message" => "Неверный метод запроса."];
}

echo json_encode($response);
?>
