<?php
declare(strict_types=1);
require __DIR__ . '/../src/php/CmsCodec.php';
use DiscussionBridge\CmsV4\Codec;
use DiscussionBridge\CmsV4\ValidationException;
use DiscussionBridge\CmsV4\IdnaVendor\Rowbot\Idna\CodePoint;
use DiscussionBridge\CmsV4\IdnaVendor\Rowbot\Idna\Idna;
use DiscussionBridge\CmsV4\IdnaVendor\Symfony\Polyfill\Intl\Normalizer\Normalizer;

$codec = new Codec(__DIR__ . '/../src/cms-schema.json');
$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$options = ['CheckHyphens' => false, 'CheckBidi' => true, 'CheckJoiners' => true,
    'UseSTD3ASCIIRules' => false, 'Transitional_Processing' => false,
    'VerifyDnsLength' => false, 'IgnoreInvalidPunycode' => false];
$results = [];
$ingress = 0;
foreach ($input as $item) {
    $source = implode('', array_map([CodePoint::class, 'encode'], $item['points']));
    if ($item['illFormed']) {
        // PHP JSON strings cannot carry surrogate code points. Exercise the
        // actual strict UTF8 URL boundary instead of silently skipping them.
        try {
            $codec->validate('Url', 'https://' . $source . '/');
            $results[] = ['id' => $item['id'], 'boundary' => 'utf8', 'invalid' => false];
        } catch (ValidationException $error) {
            $results[] = ['id' => $item['id'], 'boundary' => 'utf8', 'invalid' => $error->validationCode === 'invalid_field'];
        }
        ++$ingress;
    } else {
        $result = Idna::toAscii($source, $options);
        $results[] = ['id' => $item['id'], 'boundary' => 'idna', 'invalid' => $result->hasErrors(),
            'ascii' => $result->hasErrors() ? null : $result->getDomain()];
    }
}
$checks = $statusChecks = $rows = 0;
$failures = [];
foreach (file(__DIR__ . '/../fixtures/unicode17/NormalizationTest.txt') as $index => $raw) {
    $body = trim(explode('#', $raw)[0]);
    if ($body === '' || $body[0] === '@') continue;
    $cols = array_map(static fn(string $value): string => implode('', array_map(
        static fn(string $hex): string => CodePoint::encode((int) hexdec($hex)),
        preg_split('/\s+/', trim($value)))), array_slice(explode(';', $body), 0, 5));
    foreach ($cols as $column => $source) {
        $expected = $cols[$column < 3 ? 1 : 3];
        $actual = Normalizer::normalize($source, Normalizer::NFC);
        ++$checks;
        if ($actual !== $expected && count($failures) < 12) $failures[] = ['line' => $index + 1, 'column' => $column + 1, 'kind' => 'nfc', 'expected' => bin2hex($expected), 'actual' => is_string($actual) ? bin2hex($actual) : false];
        $status = Normalizer::isNormalized($source, Normalizer::NFC);
        ++$statusChecks;
        if ($status !== ($source === $expected) && count($failures) < 12) $failures[] = ['line' => $index + 1, 'column' => $column + 1, 'kind' => 'status'];
    }
    ++$rows;
}
echo json_encode(['idna' => $results, 'utf8_ingress_cases' => $ingress, 'nfc_rows' => $rows,
    'nfc_checks' => $checks, 'status_checks' => $statusChecks, 'failures' => $failures], JSON_THROW_ON_ERROR);
