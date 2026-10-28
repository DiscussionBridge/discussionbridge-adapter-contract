<?php
declare(strict_types=1);
require __DIR__ . '/../src/php/CmsCodec.php';

use DiscussionBridge\CmsV4\Codec;
use DiscussionBridge\CmsV4\UnsupportedBehaviorException;
use DiscussionBridge\CmsV4\ValidationException;

$codec = new Codec(__DIR__ . '/../src/cms-schema.json');
$input = json_decode(stream_get_contents(STDIN), false, 512, JSON_THROW_ON_ERROR);
$passed = 0;
$failed = 0;
$assert = static function (bool $condition) use (&$passed, &$failed): void {
    $condition ? $passed++ : $failed++;
};
$reject = static function (callable $call) use (&$passed, &$failed): void {
    try { $call(); $failed++; }
    catch (ValidationException $error) { $passed++; }
};
$copy = static fn($value) => json_decode(json_encode($value, JSON_THROW_ON_ERROR), false, 512, JSON_THROW_ON_ERROR);
$record = $codec->createGeneratedExcerpt($input->record, $input->complete, $input->article);
$moved = $codec->projectGeneratedReadMoreMove($record, 'https://publisher.example/new/?a=1&b="x"', 'native-source-r2', '2026-10-14T12:00:00.000Z');
$values = (object) [
    'excerpt' => $record,
    'moved' => $moved,
    'measurement' => $codec->measureToFullEnvelope($input->record, $input->complete),
    'link' => $codec->generatedReadMore('https://publisher.example/a?x="a"&y=\'b\''),
    'identity' => $codec->generatedSourceIdentity($record),
];
$assert($record->source_content_sha256 === hash('sha256', $input->complete));
$assert($record->source_content_bytes === strlen($input->complete));
$assert($record->representation->article_content_sha256 === hash('sha256', $input->article));
$assert($record->representation->article_content_bytes === strlen($input->article));
$assert($moved->content_html === $input->article . $codec->generatedReadMore($moved->canonical_url));
$assert($moved->representation->selection_full_request_bytes === $record->representation->selection_full_request_bytes);
$assert($moved->representation->selection_source_revision === $record->source_revision);
$assert($moved->source_content_sha256 === $record->source_content_sha256);
$assert($moved->source_content_bytes === $record->source_content_bytes);
$assert($moved->title === $record->title);
$assert($moved->external_id === $record->external_id);
$assert($moved->expected_source_revision === $record->source_revision);
$codec->validate('ToResolve', (object) ['mutation_id' => '11111111-1111-4111-8111-111111111111', 'bridge_record' => $record]); $passed++;
$codec->validate('ToResolve', (object) ['mutation_id' => '11111111-1111-4111-8111-111111111111', 'bridge_record' => $moved]); $passed++;
$reject(fn() => $codec->validateGeneratedSelection($moved));
$codec->validateGeneratedSelection($moved, $moved); $passed++;
$same = $copy($record); $same->expected_source_revision = $record->source_revision;
$same->lane = ''; $same->source_authors = []; $same->visibility = 'unlisted';
$codec->validateGeneratedSelection($same, $record); $passed++;
$assert($codec->generatedSourceIdentity($same) === $codec->generatedSourceIdentity($record));
$reject(fn() => $codec->projectGeneratedReadMoreMove($record, $record->canonical_url, 'r2', null));
$reject(fn() => $codec->createGeneratedExcerpt($input->record, $input->complete, ''));
$reject(fn() => $codec->createGeneratedExcerpt($input->record, $input->complete, '<p>DATA-DISCUSSIONBRIDGE-GENERATED</p>'));
$reject(fn() => $codec->parseJson('{"a":1,"\\u0061":2}'));
$reject(fn() => $codec->parseJson("\xff"));
$bad = $copy($record); $bad->representation->article_content_sha256 = str_repeat('0', 64);
$reject(fn() => $codec->validateGeneratedSelection($bad));
$bad = $copy($record); $bad->representation->selection_full_request_bytes = 9007199254740991;
$reject(fn() => $codec->validateGeneratedSelection($bad));
$bad = $copy($record); $bad->representation->unexpected = true;
$reject(fn() => $codec->validate('ToRecord', $bad));
$bad = $copy($record); $bad->representation->article_content_bytes = null;
$reject(fn() => $codec->validate('ToRecord', $bad));
$bad = $copy($input->record); $bad->source_content_bytes++;
$reject(fn() => $codec->measureToFullEnvelope($bad, $input->complete));
$bad = $copy($record); $bad->content_html = str_repeat('x', 49153);
$reject(fn() => $codec->validateGeneratedEnvelope($bad));
$output = (object) ['values' => $values, 'passed' => $passed, 'failed' => $failed];
if (isset($input->codec_regressions)) {
    $regressions = (object) ['urls' => [], 'resolve' => []];
    foreach ($input->codec_regressions->urls as $url) {
        try {
            $value = $codec->validate('Url', $url);
            $accepted = true;
        } catch (ValidationException | UnsupportedBehaviorException) {
            $value = null;
            $accepted = false;
        }
        $regressions->urls[] = (object) ['url' => $url, 'accepted' => $accepted, 'value' => $value];
    }
    $admitted = static function (callable $call): bool {
        try { $call(); return true; }
        catch (ValidationException) { return false; }
    };
    foreach ($input->codec_regressions->resolve as $case) {
        $regressions->resolve[] = (object) [
            'outcome' => $case->response->outcome,
            'status' => $case->status,
            'validated' => $admitted(fn() => $codec->validateResponse('V4-02', $case->response, $case->status)),
            'decoded' => $admitted(fn() => $codec->decodeResponse('V4-02', $codec->encodeJson($case->response), $case->status)),
        ];
    }
    $output->codec_regressions = $regressions;
}
echo json_encode($output, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
exit($failed === 0 ? 0 : 1);
