<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/php/CmsCodec.php';

use DiscussionBridge\CmsV4\Codec;
use DiscussionBridge\CmsV4\ValidationException;

$codec = new Codec(__DIR__ . '/../src/cms-schema.json');
$urls = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$results = [];
foreach ($urls as $url) {
    try {
        $result = $codec->validate('Url', $url);
        $results[] = ['accepted' => true, 'value' => $result];
    } catch (ValidationException $error) {
        $results[] = ['accepted' => false, 'code' => $error->validationCode];
    }
}
echo json_encode($results, JSON_THROW_ON_ERROR);
