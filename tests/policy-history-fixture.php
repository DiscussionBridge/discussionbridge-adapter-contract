<?php
declare(strict_types=1);
require __DIR__ . '/../src/php/CmsCodec.php';
$codec = new \DiscussionBridge\CmsV4\Codec(__DIR__ . '/../src/cms-schema.json');
$cases = json_decode(stream_get_contents(STDIN), false, 512, JSON_THROW_ON_ERROR);
$result = [];
foreach ($cases as $case) {
    try {
        $codec->validate('PolicyHistoryPage', $case->value);
        $result[] = true;
    } catch (\DiscussionBridge\CmsV4\ValidationException $error) {
        $result[] = false;
    }
}
echo json_encode($result, JSON_THROW_ON_ERROR);
