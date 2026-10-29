<?php
declare(strict_types=1);
require __DIR__ . '/../src/php/CmsCodec.php';
use DiscussionBridge\CmsV4\Codec;
use DiscussionBridge\CmsV4\ValidationException;
$codec = new Codec(__DIR__ . '/../src/cms-schema.json');
$fixtures = json_decode(file_get_contents(__DIR__ . '/../fixtures/positive-examples.json'), false, 512, JSON_THROW_ON_ERROR);
$base = null;
foreach ($fixtures->fixtures as $fixture) if ($fixture->id === 'connection') $base = $fixture->value;
if ($base === null) throw new RuntimeException('Missing ordinary Connection fixture');
$input = json_decode(stream_get_contents(STDIN), false, 512, JSON_THROW_ON_ERROR);
$results = [];
foreach ($input as $item) {
    $value = clone $base;
    $value->destination_origin = $item->url;
    $result = ['id' => $item->id];
    foreach (['typed', 'route', 'decoded-route'] as $mode) {
        try {
            $checked = $value;
            if ($mode === 'typed') $codec->validate('Connection', $value);
            elseif ($mode === 'route') $codec->validateResponse('V4-01', $value, 200);
            else {
                $checked = $codec->parseJson($codec->encodeJson($value));
                $codec->validateResponse('V4-01', $checked, 200);
            }
            $result[$mode] = ['accepted' => true, 'origin' => $checked->destination_origin];
        } catch (ValidationException $error) {
            $result[$mode] = ['accepted' => false, 'code' => $error->validationCode, 'path' => $error->path];
        }
    }
    $results[] = $result;
}
echo json_encode($results, JSON_THROW_ON_ERROR);
