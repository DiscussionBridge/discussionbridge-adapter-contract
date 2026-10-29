<?php
declare(strict_types=1);
require __DIR__ . '/../src/php/CmsCodec.php';
use DiscussionBridge\CmsV4\Codec;
use DiscussionBridge\CmsV4\ValidationException;
$codec = new Codec(__DIR__ . '/../src/cms-schema.json');
$cases = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$results = [];
foreach ($cases as $case) {
    try {
        $facts = $codec->urlAuthority($case['url']);
        $results[] = ['id' => $case['id'], 'accepted' => true, 'value' => $codec->validate('Url', $case['url']), 'facts' => $facts];
    } catch (ValidationException $error) {
        $results[] = ['id' => $case['id'], 'accepted' => false, 'code' => $error->validationCode];
    }
}
echo json_encode($results, JSON_THROW_ON_ERROR);
