<?php
declare(strict_types=1);

// Deliberately conflicting public packages/extension shims must not participate
// in the private runtime. CI disables the optional native functions as well.
namespace Rowbot\Idna { final class Idna { public static function toAscii(): never { throw new \RuntimeException('ambient Rowbot selected'); } } }
namespace Symfony\Polyfill\Intl\Normalizer { class Normalizer {} }
namespace Symfony\Polyfill\Mbstring { class Mbstring {} }
namespace {
    if (extension_loaded('intl')) throw new RuntimeException('Isolation test requires no native intl');
    class Normalizer {
        public static function isNormalized(): never { throw new RuntimeException('ambient Normalizer selected'); }
        public static function normalize(): never { throw new RuntimeException('ambient Normalizer selected'); }
    }
    if (!function_exists('mb_ord')) { function mb_ord(): never { throw new RuntimeException('ambient mb_ord selected'); } }
    if (!function_exists('mb_str_split')) { function mb_str_split(): never { throw new RuntimeException('ambient mb_str_split selected'); } }
    require __DIR__ . '/../src/php/CmsCodec.php';
    $codec = new \DiscussionBridge\CmsV4\Codec(__DIR__ . '/../src/cms-schema.json');
    $cases = json_decode(file_get_contents(__DIR__ . '/../fixtures/url-idna-hosts.json'), true, 512, JSON_THROW_ON_ERROR);
    $checks = 0;
    foreach ($cases['valid'] as $url) {
        if ($codec->validate('Url', $url) !== $url) throw new RuntimeException('URL bytes changed');
        ++$checks;
    }
    foreach ($cases['invalid'] as $url) {
        try { $codec->validate('Url', $url); throw new RuntimeException('Invalid URL accepted'); }
        catch (\DiscussionBridge\CmsV4\ValidationException $error) {
            if ($error->validationCode !== 'invalid_field') throw $error;
            ++$checks;
        }
    }
    echo json_encode(['checks' => $checks, 'optional_functions' => array_intersect(['iconv', 'idn_to_ascii'], get_defined_functions()['internal'])], JSON_THROW_ON_ERROR) . "\n";
}
