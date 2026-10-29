<?php
declare(strict_types=1);
require $argv[1];
try {
    $codec = new \DiscussionBridge\CmsV4\Codec($argv[2]);
    $url = 'https://é.example/Original?x=%2F';
    if ($codec->validate('Url', $url) !== $url) throw new RuntimeException('URL bytes changed');
    echo "portable-idna-ok\n";
} catch (RuntimeException $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
