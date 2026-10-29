<?php
declare(strict_types=1);

// Build only the separately locked runtime project, never this tool's vendor.
// No global aliases may expose the private dependencies to the host application.
return [
    'prefix' => 'DiscussionBridge\\CmsV4\\IdnaVendor',
    'php-version' => '8.1',
    'expose-global-classes' => false,
    'expose-global-functions' => false,
    'expose-global-constants' => false,
    'patchers' => [
        static function (string $filePath, string $prefix, string $contents): string {
            $filePath = str_replace('\\', '/', $filePath);
            // PHP-Scoper intentionally leaves native/polyfill symbol references
            // global. Bind the IDNA algorithm to this bundle's private shims,
            // never an ambient intl/mbstring/Symfony installation.
            if (str_ends_with($filePath, '/rowbot/idna/src/Idna.php')
                || str_ends_with($filePath, '/rowbot/idna/src/LabelValidator.php')) {
                $contents = str_replace('use Normalizer;', 'use ' . $prefix . '\\Normalizer;', $contents, $count);
                if ($count !== 1) throw new RuntimeException('Unexpected IDNA Normalizer binding');
            }
            if (str_ends_with($filePath, '/rowbot/idna/src/CodePoint.php')) {
                foreach (['mb_ord', 'mb_str_split'] as $function) {
                    $contents = str_replace('use function ' . $function . ';', 'use function ' . $prefix . '\\' . $function . ';', $contents, $count);
                    if ($count !== 1) throw new RuntimeException('Unexpected IDNA UTF-8 binding');
                }
            }
            if (str_ends_with($filePath, '/rowbot/idna/src/LabelValidator.php')) {
                $replacement = file_get_contents(__DIR__ . '/../../implementation/php-contextj.php.in');
                if ($replacement === false) throw new RuntimeException('Missing private ContextJ source');
                $contents = preg_replace_callback('~    protected function isValidContextJ\(string \$label, array \$codePoints\): bool\n    \{.*?\n    \}(?=\n    /\*\*)~s',
                    static fn(): string => rtrim($replacement, "\r\n"), $contents, -1, $count);
                if ($count !== 1) throw new RuntimeException('Unexpected ContextJ source boundary');
            }
            if (str_ends_with($filePath, '/symfony/polyfill-intl-normalizer/Normalizer.php')) {
                $contents = preg_replace_callback('~(?<![A-Za-z0-9_\\\\])\\\\Normalizer::~', static fn(): string => '\\' . $prefix . '\\Normalizer::', $contents, -1, $count);
                if ($count !== 9) throw new RuntimeException('Unexpected normalization constant bindings');
            }
            if (str_ends_with($filePath, '/symfony/polyfill-intl-normalizer/Resources/stubs/Normalizer.php')) {
                $contents = preg_replace('~^\\\\class_alias\\([^\\r\\n]+\\);\\R?~m', '', $contents, -1, $count);
                if ($count !== 1) throw new RuntimeException('Unexpected global Normalizer export');
            }
            return $contents;
        },
    ],
];
