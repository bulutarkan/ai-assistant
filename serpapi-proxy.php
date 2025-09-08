<?php
// PHP Error Reporting
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// CORS headers - Tüm domainlere izin ver
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');
header('Content-Type: application/json');

// OPTIONS preflight request için
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Sadece GET isteklere izin ver
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'error' => 'Method not allowed',
        'allowed_methods' => ['GET', 'OPTIONS']
    ]);
    exit;
}

try {
    // Query parameters'ı al
    $query_params = $_GET;

    // API key'yi al ve security için query'den çıkar
    $api_key = isset($query_params['api_key']) ? $query_params['api_key'] : '';
    unset($query_params['api_key']); // URL'den göstermemek için

    // SerpApi URL'sini oluştur
    $serpapi_url = 'https://serpapi.com/search.json?' . http_build_query($query_params);
    if (!empty($api_key)) {
        $serpapi_url .= '&api_key=' . $api_key;
    }

    error_log('SerpApi Proxy - Requesting: ' . preg_replace('/api_key=[^&]*/', 'api_key=***', $serpapi_url));

    // SerpApi'ye istek gönder
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 30,
            'ignore_errors' => true,
            'user_agent' => 'SerpApiProxy/1.0',
        ]
    ]);

    $response = file_get_contents($serpapi_url, false, $context);

    if ($response === false) {
        throw new Exception('Failed to fetch from SerpApi');
    }

    // Check for HTTP response code
    $http_response_header = isset($http_response_header) ? $http_response_header : [];

    foreach ($http_response_header as $header) {
        if (strpos($header, 'HTTP/') === 0) {
            $status_code = (int) explode(' ', $header)[1];
            if ($status_code >= 400) {
                http_response_code($status_code);
            }
            break;
        }
    }

    // JSON response'u döndür
    echo $response;

    error_log('SerpApi Proxy - Success: ' . strlen($response) . ' bytes returned');

} catch (Exception $e) {
    error_log('SerpApi Proxy Error: ' . $e->getMessage());

    http_response_code(500);
    echo json_encode([
        'error' => 'Proxy failed',
        'message' => $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s')
    ]);
}
?>
