<?php
declare(strict_types=1);
require __DIR__ . '/../src/php/CmsCodec.php';
use DiscussionBridge\CmsV4\Codec;
use DiscussionBridge\CmsV4\ValidationException;
$codec = new Codec(__DIR__ . '/../src/cms-schema.json');
$cases = json_decode(stream_get_contents(STDIN), false, 512, JSON_THROW_ON_ERROR);
$results = [];
foreach ($cases as $case) {
    try {
        $value = match ($case->action) {
            'validate' => $codec->validate($case->type, $case->value),
            'feed' => $codec->validateAttentionFeedPage($case->type, $case->value, $case->after),
            'capability' => $codec->assertAttentionRecoveryCapability($case->value, $case->profile),
            'lease' => $codec->validateAttentionRecoveryLease($case->recovery, $case->value),
            'query' => $codec->parseQuery('AttentionFeedQuery', $case->raw),
            'response' => $codec->validateResponse($case->route, $case->value, $case->status),
            'identity' => $codec->semanticIdentity($case->value),
            default => throw new RuntimeException('Unknown test action'),
        };
        $results[] = ['id' => $case->id, 'accepted' => true, 'identity' => $codec->semanticIdentity($value)];
    } catch (ValidationException $error) {
        $results[] = ['id' => $case->id, 'accepted' => false, 'code' => $error->validationCode, 'path' => $error->path];
    }
}
echo json_encode($results, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
