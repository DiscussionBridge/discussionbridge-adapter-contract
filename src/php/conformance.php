<?php
declare(strict_types=1);

require_once __DIR__ . '/CmsCodec.php';

use DiscussionBridge\CmsV4\Codec;
use DiscussionBridge\CmsV4\NoContent;
use DiscussionBridge\CmsV4\UnsupportedBehaviorException;
use DiscussionBridge\CmsV4\ValidationException;

$root = dirname(__DIR__, 2);
$codec = new Codec($root . '/src/cms-schema.json');
$read = static fn(string $path) => json_decode(file_get_contents($root . '/' . $path), false, 512, JSON_THROW_ON_ERROR);
$sourceExamples = $read('fixtures/positive-examples.json');
$cases = $read('fixtures/rejection-cases.json');
$numeric = $read('fixtures/numeric-lexemes.json');
$schema = $read('src/cms-schema.json');
$examples = array_values(array_filter($sourceExamples->fixtures, fn($item) => $codec->hasType($item->type)));
$byId = [];
$byType = [];
foreach ($examples as $item) {
    $byId[$item->id] = $item->value;
    $byType[$item->type] ??= $item->value;
}
$copy = static fn($value) => unserialize(serialize($value));
$example = static fn(string $id) => $copy($byId[$id]);
$passed = 0;
$failures = [];
$check = static function (bool $condition, string $message = 'assertion failed'): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};
$reject = static function (callable $callback, string $code = 'invalid_field', ?string $path = null) use ($check): void {
    try {
        $callback();
    } catch (ValidationException $error) {
        $check($error->validationCode === $code, 'unexpected validation code');
        if ($path !== null) {
            $check($error->path === $path, 'unexpected validation path');
        }
        return;
    }
    throw new RuntimeException('expected typed rejection');
};
$unsupported = static function (callable $callback): void {
    try {
        $callback();
    } catch (UnsupportedBehaviorException) {
        return;
    }
    throw new RuntimeException('expected explicit implementation limitation');
};
$run = static function (string $name, callable $callback) use (&$passed, &$failures): void {
    try {
        $callback();
        $passed++;
    } catch (Throwable $error) {
        $failures[] = $name . ': ' . get_class($error) . ' — ' . $error->getMessage();
    }
};

$run('single V4 identities/count', function () use ($root, $examples, $schema, $check): void {
    $check(count($examples) === 58);
    $check(count($schema->routes) === 36);
    $check(count(get_object_vars($schema->types)) === 169);
    $check(hash_file('sha256', $root . '/src/cms-schema.json') === Codec::SCHEMA_SHA256);
});
foreach (['https://xn--bcher-kva.example/', 'https://bücher.example/', 'https://é.example/', 'https://例え.テスト/', 'https://127.1/', 'https://0x7f000001/', 'https://0x7f.0.0.1/', 'https://0177.0.0.1/', 'https://publisher.example/', 'https://127.0.0.1/', 'https://[::1]/'] as $origin) {
    $run('Connection origin preserves bytes ' . $origin, function () use ($codec, $example, $check, $origin): void {
        $value = $example('connection');
        $value->destination_origin = $origin;
        $check($codec->validateResponse('V4-01', $value, 200) === $value);
        $check($value->destination_origin === $origin, 'origin identity rewritten');
    });
}
foreach ($examples as $item) {
    $run('derived V4 positive ' . $item->id, function () use ($codec, $item, $check): void {
        $value = $codec->parseJson($codec->encodeJson($item->value), 262144);
        $check($codec->validate($item->type, $value) === $value);
        $check($codec->semanticIdentity($value) === $codec->semanticIdentity($item->value), 'parsed value changed');
    });
}
foreach ($cases->type_cases as $item) {
    if ($item->profile === 'v4' && $codec->hasType($item->type)) {
        $run('derived V4 rejection ' . $item->id, fn() => $reject(fn() => $codec->validate($item->type, $item->input), $item->expected->code));
    }
}
foreach ($cases->raw_json_cases as $item) {
    if ($item->profile === 'v4') {
        $run('derived V4 raw rejection ' . $item->id, fn() => $reject(fn() => $codec->parseJson($item->raw), $item->expected->code));
    }
}
foreach ($schema->routes as $route) {
    $run('typed current route ' . $route->id, function () use ($codec, $route, $byType, $check): void {
        $body = $route->input === null ? null : $byType[$route->input];
        $query = $route->query === null ? new stdClass() : $byType[$route->query];
        $path = new stdClass();
        preg_match_all('~\{([^}]+)\}~', $route->path, $matches);
        foreach ($matches[1] as $key) {
            $path->$key = $body->$key ?? $body->authority->$key
                ?? ($key === 'source_id' ? 'topic:8' : ($key === 'source_revision' ? 'source-r1' : '11111111-1111-4111-8111-000000000001'));
        }
        $options = [
            'method' => $route->method,
            'path' => $path,
            'queryString' => http_build_query(get_object_vars($query), '', '&', PHP_QUERY_RFC3986),
        ];
        if ($route->method === 'POST') {
            $options['rawBody'] = $codec->encodeJson($body);
            $options['mediaType'] = 'application/json; charset=UTF-8';
        }
        $parsed = $codec->parseRequest($route->id, $options);
        $check($parsed['query'] instanceof stdClass);
        $response = $byType[$route->response];
        // The ResolveResult fixture is specifically created, whose status is201.
        $statuses = $route->id === 'V4-02' ? [201] : $route->success_http;
        foreach ($statuses as $status) {
            if ($status === 204) {
                $check($codec->decodeResponse($route->id, '', $status) === NoContent::VALUE);
                continue;
            }
            $decoded = $codec->decodeResponse($route->id, $codec->encodeJson($response), $status);
            $check($codec->semanticIdentity($decoded) === $codec->semanticIdentity($response), 'response value changed');
        }
    });
}

foreach ($numeric->valid as $item) {
    $run('exact numeric ' . $item->id, function () use ($codec, $item, $check): void {
        $value = $codec->parseJson('{"offset":' . $item->lexeme . '}');
        $check(is_int($value->offset) && $value->offset === $item->value, 'numeric value changed');
        $codec->validate('ContentQuery', $value);
    });
}
foreach ($numeric->invalid as $item) {
    $run('numeric rejection ' . $item->id, function () use ($codec, $item, $reject): void {
        $raw = '{"offset":' . $item->lexeme . '}';
        $reject(fn() => $codec->parseJson($raw));
        $value = $codec->parseJson($raw, 65536, false);
        $reject(fn() => $codec->validate('ContentQuery', $value), 'invalid_field', '$.offset');
        $reject(fn() => $codec->encodeJson($value));
    });
}
foreach ($numeric->syntax_errors as $item) {
    $run('syntax precedes numeric ' . $item->id, fn() => $reject(fn() => $codec->parseJson($item->raw), 'invalid_json'));
}

$run('objects lists null and omission survive', function () use ($codec, $check): void {
    $raw = '{"empty_object":{},"empty_list":[],"explicit_null":null}';
    $value = $codec->parseJson($raw);
    $check($value->empty_object instanceof stdClass && is_array($value->empty_list));
    $check(property_exists($value, 'explicit_null') && !property_exists($value, 'omitted'));
    $check($codec->encodeJson($value) === $raw);
});
$run('native object-key representation limitation is explicit', function () use ($codec, $unsupported): void {
    $unsupported(fn() => $codec->parseJson('{"\u0000x":true}'));
});
$run('duplicate decoded keys at nested depths', function () use ($codec, $reject): void {
    foreach (['{"a":1,"\u0061":2}', '{"nested":{"x":1,"x":2}}', '{"list":[{"x":1,"\u0078":2}]}'] as $raw) {
        $reject(fn() => $codec->parseJson($raw), 'invalid_json');
    }
});
$run('syntax whitespace trailing tokens and object root', function () use ($codec, $reject, $check): void {
    $check($codec->parseJson(" \r\n\t{} \t") instanceof stdClass);
    foreach (['[]', 'null', 'true', '1', '{"a":1}{}', '{"a":1,}', '{"a":[1,]}', '{"a":01}', '{"a":1.}', '{"a":+1}', "{\v}"] as $raw) {
        $reject(fn() => $codec->parseJson($raw), 'invalid_json');
    }
});
$run('strict raw UTF8 BOM and surrogate decoding', function () use ($codec, $reject, $check): void {
    foreach (["\xef\xbb\xbf{}", "{\"x\":\"\xc3(\"}", "{\"x\":\"\xc0\xaf\"}", '{"x":"\ud800"}', '{"x":"\udc00"}'] as $raw) {
        $reject(fn() => $codec->parseJson($raw), 'invalid_json');
    }
    $value = $codec->parseJson('{"x":"\ud83d\ude00"}');
    $check($value->x === '😀' && strlen($value->x) === 4);
});
$run('strict request raw byte maximum', function () use ($codec, $reject, $check): void {
    $check($codec->parseJson('{}' . str_repeat(' ', 65534)) instanceof stdClass);
    $reject(fn() => $codec->parseJson('{}' . str_repeat(' ', 65535)), 'body_too_large');
});
$run('bounded metadata and chunk raw responses', function () use ($codec, $example, $reject): void {
    $record = $codec->encodeJson($example('record'));
    $codec->decodeResponse('V4-04', $record . str_repeat(' ', 262144 - strlen($record)), 200);
    $reject(fn() => $codec->decodeResponse('V4-04', $record . str_repeat(' ', 262145 - strlen($record)), 200), 'body_too_large');
    $chunk = $codec->encodeJson($example('content_chunk'));
    $codec->decodeResponse('V4-07', $chunk . str_repeat(' ', 65536 - strlen($chunk)), 200);
    $reject(fn() => $codec->decodeResponse('V4-07', $chunk . str_repeat(' ', 65537 - strlen($chunk)), 200), 'body_too_large');
});
$run('metadata encoded byte maximum without truncation', function () use ($codec, $example, $reject): void {
    $record = $example('record');
    $record->canonical_url = 'https://publisher.example/' . str_repeat('a', 1900);
    $record->topic_url = 'https://forum.example/' . str_repeat('b', 1900);
    $page = $example('record_page');
    $page->items = array_fill(0, 100, $record);
    $codec->validate('RecordPage', $page);
    $reject(fn() => $codec->validateResponse('V4-03', $page, 200), 'metadata_unavailable');
});
$run('Unicode nonblank original byte preservation', function () use ($codec, $example, $reject, $check): void {
    foreach (['', ' ', "\u{00A0}", "\u{2003}", "\u{FEFF}", "\u{1680}\u{2028}\u{3000}"] as $name) {
        $connection = $example('connection');
        $connection->forum_name = $name;
        $reject(fn() => $codec->validate('Connection', $connection), 'invalid_field', '$.forum_name');
    }
    foreach (["\u{00A0}Forum\u{2003}", "\u{FEFF}Forum\u{FEFF}", str_repeat('é', 100), str_repeat('😀', 50), '<Source & Forum>'] as $name) {
        $connection = $example('connection');
        $connection->forum_name = $name;
        $check($codec->validate('Connection', $connection)->forum_name === $name, 'label was normalized');
        $roundTrip = $codec->parseJson($codec->encodeJson($connection));
        $check($roundTrip->forum_name === $name, 'label bytes changed during codec round trip');
    }
    foreach (["Forum\u{0085}", "Forum\n", "Forum\x7f", str_repeat('é', 100) . ' ', str_repeat('😀', 51), "\xed\xa0\x80"] as $name) {
        $connection = $example('connection');
        $connection->forum_name = $name;
        $reject(fn() => $codec->validate('Connection', $connection));
    }
});
$run('UTF8 identities are not normalized', function () use ($codec, $reject, $check): void {
    $codec->validate('OpaqueId', str_repeat('é', 127));
    $reject(fn() => $codec->validate('OpaqueId', str_repeat('é', 128)));
    $check($codec->semanticIdentity('é') !== $codec->semanticIdentity("e\u{0301}"));
});
$run('closed fields nullable omission and native type distinctions', function () use ($codec, $example, $reject): void {
    $claim = $example('claim');
    $claim->unexpected = true;
    $reject(fn() => $codec->validate('Claim', $claim), 'unknown_field');
    $reject(fn() => $codec->validate('Claim', []));
    $reject(fn() => $codec->validate('UInt', true));
    $reject(fn() => $codec->validate('Boolean', 1));
    $reject(fn() => $codec->validate('CoreId', 8));
    $reject(fn() => $codec->validate('UInt', -0.0));
    $reject(fn() => $codec->validate('UInt', 1.25));
    $connection = $example('connection');
    unset($connection->forum_name);
    $reject(fn() => $codec->validate('Connection', $connection), 'invalid_field', '$.forum_name');
    $connection->forum_name = null;
    $reject(fn() => $codec->validate('Connection', $connection));
});
$run('declared defaults only with no input mutation', function () use ($codec, $example, $check): void {
    $query = new stdClass();
    $defaults = $codec->defaults('ContentQuery', $query);
    $check($defaults->offset === 0 && !property_exists($query, 'offset'));
    $record = $example('to_resolve');
    $before = $codec->semanticIdentity($record);
    $codec->defaults('ToResolve', $record);
    $check($codec->semanticIdentity($record) === $before);
});
$run('decimal CoreId bound and exact strings', function () use ($codec, $reject, $check): void {
    $id = '9223372036854775807';
    $check($codec->validate('CoreId', $id) === $id);
    foreach (['0', '01', '9223372036854775808', '1e0'] as $id) {
        $reject(fn() => $codec->validate('CoreId', $id));
    }
});
$run('schema patterns match the complete decoded value', function () use ($codec, $reject): void {
    foreach (["\n", "\r", "\r\n", "\u{2028}", "\u{2029}", "\u{0085}"] as $tail) {
        $reject(fn() => $codec->validate('Sha256', str_repeat('a', 64) . $tail));
        $reject(fn() => $codec->validate('CoreId', '1' . $tail));
    }
});
$run('canonical base64 unused bits and token byte bounds', function () use ($codec, $reject, $check): void {
    $codec->validate('Base64', base64_encode('native'));
    foreach (['AA', 'AB==', 'AA== ', '-A=='] as $base64) {
        $reject(fn() => $codec->validate('Base64', $base64));
    }
    $token = rtrim(strtr(base64_encode(str_repeat("\x01", 32)), '+/', '-_'), '=');
    $check($codec->validate('LeaseToken', $token) === $token);
    $reject(fn() => $codec->validate('LeaseToken', substr($token, 0, -1) . 'B'));
});
$run('exact UTC millisecond instants and ordering', function () use ($codec, $example, $reject): void {
    $codec->validate('Instant', '2024-02-29T23:59:59.999Z');
    foreach (['2023-02-29T00:00:00.000Z', '2026-10-09T18:00:00Z', '2026-10-09T18:00:60.000Z', '2026-10-09T24:00:00.000Z', '2026-10-09T18:00:00.000+00:00'] as $instant) {
        $reject(fn() => $codec->validate('Instant', $instant));
    }
    $record = $example('record');
    $record->source_updated_at = '2020-01-01T00:00:00.000Z';
    $reject(fn() => $codec->validate('Record', $record), 'invalid_field', '$.source_updated_at');
});
$run('ordinary HTTPS URL checks without normalization', function () use ($codec, $reject, $check): void {
    foreach (['https://publisher.example/path?a=1', 'https://127.0.0.1:443/path', 'https://[::1]/path', 'HTTPS://Forum.Example/'] as $url) {
        $check($codec->validate('Url', $url) === $url);
    }
    foreach (['http://example.test/', 'https://user@example.test/', 'https://example.test/#', 'https://example.test/a/../b', 'https://example.test/a/%2e%2e/b', 'https://example.test/%GG', 'https://example.test/ white', 'https://example.test:65536/', 'https://[not-ip]/'] as $url) {
        $reject(fn() => $codec->validate('Url', $url));
    }
});
$run('raw backslash URL processing is refused including hidden dot segments', function () use ($codec, $reject, $check): void {
    foreach ([
        'https://example.test/a\\..\\b',
        'https://example.test/a\\../b',
        'https://example.test/a/..\\b',
        'https://example.test/a\\%2e%2e\\b',
        'https://example.test/a/%2e%2e\\b',
        'https://example.test/a\\%2E./b',
        'https://example.test\\path',
        'https://example.test/path?query=\\value',
    ] as $url) {
        $reject(fn() => $codec->validate('Url', $url));
        $reject(fn() => $codec->generatedReadMore($url));
    }
    foreach ([
        'https://EXAMPLE.test:443/Content%2FOne/?x=1&x=2',
        'https://example.test/a%5Cb/?q=%5c',
        'https://example.test/a%5C..%5Cb/',
        'https://example.test/%255Cpath/',
    ] as $url) $check($codec->validate('Url', $url) === $url, 'encoded URL bytes changed');
});
$run('private IDNA host processing preserves exact caller identities', function () use ($codec, $read, $reject, $check): void {
    $cases = $read('fixtures/url-idna-hosts.json');
    foreach ($cases->valid as $url) $check($codec->validate('Url', $url) === $url, 'URL identity rewritten');
    foreach ($cases->invalid as $url) $reject(fn() => $codec->validate('Url', $url));
});
$run('numeric IPv4 hosts preserve identity and reject invalid or overflowing numbers', function () use ($codec, $read, $reject, $check): void {
    $cases = $read('fixtures/url-numeric-hosts.json');
    foreach ($cases->valid as $url) $check($codec->validate('Url', $url) === $url, 'URL identity rewritten');
    foreach ($cases->invalid as $url) $reject(fn() => $codec->validate('Url', $url));
    $reject(fn() => $codec->validate('Url', 'https://' . str_repeat('9', 1800) . '/'));
});
$run('query decoded key duplication and field/type bounds', function () use ($codec, $reject, $check): void {
    $check($codec->parseQuery('SourceFeedQuery', 'stream=initial')->stream === 'initial');
    foreach (['stream=initial&stream=changes', 'stream=initial&str%65am=initial', 'stream=initial&unknown=1', 'stream=initial&', 'stream=%GG', 'stream=%C3%28'] as $query) {
        $code = str_contains($query, 'unknown') ? 'unknown_field' : 'invalid_field';
        $reject(fn() => $codec->parseQuery('SourceFeedQuery', $query), $code);
    }
    $check($codec->parseQuery('ContentQuery', 'offset=9007199254740991')->offset === 9007199254740991);
    foreach (['offset=01', 'offset=1e0', 'offset=9007199254740992', 'offset=-0', 'offset=1&off%73et=2'] as $query) {
        $reject(fn() => $codec->parseQuery('ContentQuery', $query));
    }
    $reject(fn() => $codec->parseQuery('ContentQuery', 'offset=9007199254740992'), 'invalid_field', '$.offset');
    $reject(fn() => $codec->parseQuery('SourceFeedQuery', 'stream=initial&limit=100'), 'unknown_field');
    $reject(fn() => $codec->parseQuery('SourceFeedQuery', 'stream=changes'));
    $reject(fn() => $codec->parseQuery(null, 'x=1'), 'unknown_field');
});
$run('request method media encoding and stage order', function () use ($codec, $example, $reject): void {
    $raw = $codec->encodeJson($example('claim'));
    foreach (['text/plain', 'application/json; charset=ASCII', 'application/json; extra=1'] as $media) {
        $reject(fn() => $codec->parseRequest('V4-13', ['rawBody' => $raw, 'mediaType' => $media]), 'unsupported_media_type');
    }
    $codec->parseRequest('V4-13', ['rawBody' => $raw, 'mediaType' => 'APPLICATION/JSON; charset="UTF-8"', 'contentEncoding' => 'IDENTITY']);
    $codec->parseRequest('V4-13', ['rawBody' => $raw, 'mediaType' => "application/json;\u{00A0}charset=UTF-8"]);
    $reject(fn() => $codec->parseRequest('V4-13', ['rawBody' => $raw, 'mediaType' => 'application/json', 'contentEncoding' => 'gzip']), 'unsupported_media_type');
    $reject(fn() => $codec->parseRequest('V4-01', ['rawBody' => '{}']));
    $reject(fn() => $codec->parseRequest('V4-13', ['method' => 'GET', 'rawBody' => '{']), 'invalid_field');
    $reject(fn() => $codec->parseRequest('V4-13', ['rawBody' => '{', 'mediaType' => 'application/json', 'queryString' => 'unknown=1']), 'invalid_json');
    $reject(fn() => $codec->parseRequest('V4-01', ['queryString' => null]), 'invalid_field', '$.query');
    $reject(fn() => $codec->validateRoute('V4-01', ['query' => null]), 'unknown_field', '$.query');
});
$run('route path identity and annotated field error precedence', function () use ($codec, $example, $reject): void {
    $renew = $example('renew');
    $wrong = '11111111-1111-4111-8111-000000000099';
    $reject(fn() => $codec->validateRoute('V4-15', ['body' => $renew, 'path' => ['work_id' => $wrong]]), 'identity_conflict', '$.work_id');
    $raw = '{"mutation_id":"' . $example('claim')->mutation_id . '","unexpected":1.00000000000000001}';
    $reject(fn() => $codec->parseRequest('V4-13', ['rawBody' => $raw, 'mediaType' => 'application/json']), 'unknown_field');
    $value = $codec->parseJson('{"source_id":"topic:8","offset":1.00000000000000001,"extra":true}', 65536, false);
    $reject(fn() => $codec->validate('ContentQuery', $value), 'invalid_field', '$.offset');
});
$run('response error envelope status and no-content distinction', function () use ($codec, $example, $reject, $check): void {
    $error = $example('error');
    $codec->validateResponse('V4-01', $error, 409);
    $reject(fn() => $codec->validateResponse('V4-01', $error, 422));
    $error->retryable = true;
    $reject(fn() => $codec->validateResponse('V4-01', $error, 409));
    $check($codec->decodeResponse('V4-13', '', 204) === NoContent::VALUE);
    foreach (['null', '{}', ' '] as $raw) {
        $reject(fn() => $codec->decodeResponse('V4-13', $raw, 204));
    }
    $reject(fn() => $codec->validateResponse('V4-13', null, 204));
    $reject(fn() => $codec->decodeResponse('V4-01', '', 204), 'invalid_json');
});
$resolveOutcomes = [
    'created' => ['record_created', 201],
    'resolved' => ['already_resolved', 200],
    'updated' => ['source_revision_updated', 200],
    'reconciliation_required' => ['identity_conflict', 409],
];
foreach ($resolveOutcomes as $outcome => [$reason, $expectedStatus]) {
    $run('To resolve outcome/status matrix ' . $outcome, function () use ($codec, $example, $check, $reject, $outcome, $reason, $expectedStatus): void {
        $response = $example('resolve_created');
        $response->outcome = $outcome;
        $response->reason = $reason;
        if ($outcome === 'reconciliation_required') {
            foreach (['resource_id', 'topic_id', 'topic_url', 'source_revision', 'synchronized_at'] as $field) $response->$field = null;
        }
        $raw = $codec->encodeJson($response);
        foreach ([200, 201, 409] as $status) {
            if ($status === $expectedStatus) {
                $check($codec->validateResponse('V4-02', $response, $status) === $response);
                $decoded = $codec->decodeResponse('V4-02', $raw, $status);
                $check($codec->semanticIdentity($decoded) === $codec->semanticIdentity($response));
            } else {
                $reject(fn() => $codec->validateResponse('V4-02', $response, $status));
                $reject(fn() => $codec->decodeResponse('V4-02', $raw, $status));
            }
        }
    });
}
$run('To resolve conflicts cannot disclose protected fields at409', function () use ($codec, $example, $copy, $reject): void {
    $original = $example('resolve_created');
    $conflict = $copy($original);
    $conflict->outcome = 'reconciliation_required';
    $conflict->reason = 'identity_conflict';
    $protectedFields = ['resource_id', 'topic_id', 'topic_url', 'source_revision', 'synchronized_at'];
    foreach ($protectedFields as $field) $conflict->$field = null;
    foreach ($protectedFields as $field) {
        $wrong = $copy($conflict);
        $wrong->$field = $original->$field;
        $reject(fn() => $codec->validateResponse('V4-02', $wrong, 409));
        $reject(fn() => $codec->decodeResponse('V4-02', $codec->encodeJson($wrong), 409));
    }
});
$run('content hash chunk continuation and receipt invariants', function () use ($codec, $example, $reject, $check): void {
    $to = $example('to_resolve');
    $to->bridge_record->content_html .= 'x';
    $reject(fn() => $codec->validate('ToResolve', $to), 'content_hash_mismatch');
    $chunk = $example('content_chunk');
    $chunk->next_offset = 1;
    $reject(fn() => $codec->validate('ContentChunk', $chunk), 'invalid_field', '$.next_offset');
    $check($codec->nativeOwnershipReceiptSha256($example('native_ownership_receipt')) === 'ef9ae2df5fa27e2ba912358f727d7031a34cbac6914cdb99b38b3a88754801e1');
    $changed = $example('native_ownership_receipt');
    $changed->native_id .= 'x';
    $check($codec->nativeOwnershipReceiptSha256($changed) !== $codec->nativeOwnershipReceiptSha256($example('native_ownership_receipt')));
});
$run('semantic invariants for lease policy verification and author identities', function () use ($codec, $example, $reject): void {
    $lease = $example('lease');
    $lease->lease_generation++;
    $reject(fn() => $codec->validate('Lease', $lease));
    $policy = $example('policy');
    $policy->include_topic_ids = ['8'];
    $policy->exclude_topic_ids = ['8'];
    $reject(fn() => $codec->validate('Policy', $policy));
    $ack = $example('verify_ack');
    $ack->verification->representation->source_content_sha256 = str_repeat('0', 64);
    $reject(fn() => $codec->validate('Ack', $ack));
});
$run('deep raw JSON implementation limit is explicit', function () use ($codec, $unsupported): void {
    $raw = '{"x":' . str_repeat('[', 514) . '0' . str_repeat(']', 514) . '}';
    $unsupported(fn() => $codec->parseJson($raw));
});
$run('errors never disclose raw untrusted values', function () use ($codec, $example, $check): void {
    $claim = $example('claim');
    $claim->secret_input = 'do-not-include-untrusted-values';
    try {
        $codec->validate('Claim', $claim);
    } catch (ValidationException $error) {
        $check($error->validationCode === 'unknown_field' && $error->httpStatus === 400);
        $check(!str_contains($error->getMessage(), 'secret_input') && !str_contains($error->getMessage(), 'do-not-include'));
        return;
    }
    throw new RuntimeException('expected rejection');
});

$preservationError = static fn() => (object) ['outcome' => 'rejected', 'code' => 'content_preservation_unavailable',
    'retryable' => false, 'retry_after_seconds' => null, 'correlation_id' => null, 'core_fallback' => false];
foreach ($schema->routes as $route) {
    $run('content preservation route applicability ' . $route->id, function () use ($codec, $route, $preservationError, $reject, $check): void {
        $error = $preservationError();
        if (in_array($route->id, ['V4-02', 'V4-29'], true)) {
            $check($codec->validateResponse($route->id, $error, 422) === $error);
            $check($codec->decodeResponse($route->id, $codec->encodeJson($error), 422)->code === $error->code);
        } else {
            $reject(fn() => $codec->validateResponse($route->id, $error, 422));
            $reject(fn() => $codec->decodeResponse($route->id, $codec->encodeJson($error), 422));
        }
    });
}
$run('content preservation permanent closed envelope and exact status', function () use ($codec, $preservationError, $reject, $check): void {
    $error = $preservationError();
    $check($codec->validate('Error', $error) === $error);
    foreach (['V4-02', 'V4-29'] as $id) {
        foreach ([400, 409, 500, 503] as $status) $reject(fn() => $codec->validateResponse($id, $error, $status));
        $wrong = clone $error; $wrong->retryable = true;
        $reject(fn() => $codec->validateResponse($id, $wrong, 422));
        $wrong = clone $error; $wrong->retry_after_seconds = 30;
        $reject(fn() => $codec->validateResponse($id, $wrong, 422));
        $wrong = clone $error; $wrong->detail = 'unapproved field';
        $reject(fn() => $codec->validateResponse($id, $wrong, 422), 'unknown_field');
    }
});
$run('To preservation cannot become From Failure or nested Work attention', function () use ($codec, $example, $preservationError, $reject): void {
    $failure = $example('failure'); $failure->code = $preservationError()->code;
    $reject(fn() => $codec->validate('Failure', $failure));
    $reject(fn() => $codec->validateRoute('V4-17', ['body' => $failure, 'path' => ['work_id' => $failure->authority->work_id]]));
    $lease = $example('lease'); $lease->work->last_failure_code = $preservationError()->code;
    $reject(fn() => $codec->validate('Work', $lease->work));
    $reject(fn() => $codec->validate('Lease', $lease));
    $reject(fn() => $codec->validateResponse('V4-13', $lease, 200));
});
$run('all existing errors retain status and Failure/Work acceptance', function () use ($codec, $schema, $example, $preservationError): void {
    foreach ($schema->errors as $spec) {
        if ($spec->code === $preservationError()->code) continue;
        $error = $preservationError(); $error->code = $spec->code; $error->retryable = $spec->retryable;
        foreach ($schema->routes as $route) $codec->validateResponse($route->id, $error, $spec->http);
        $failure = $example('failure'); $failure->code = $spec->code; $failure->retry_after_seconds = null;
        $codec->validate('Failure', $failure);
        $work = $example('lease')->work; $work->last_failure_code = $spec->code;
        $codec->validate('Work', $work);
    }
});

$run('explicit To retry uses fresh existing envelope with unchanged source edition', function () use ($codec, $example, $copy, $check, $reject): void {
    $refused = $example('to_resolve');
    $next = $copy($refused); $next->mutation_id = '22222222-2222-4222-8222-222222222222';
    $codec->validateRoute('V4-02', ['body' => $refused]); // No history inferred by shape validation.
    $codec->validateRoute('V4-02', ['body' => $next]);
    $check($codec->semanticIdentity($refused) !== $codec->semanticIdentity($next));
    $check($codec->semanticIdentity($refused->bridge_record) === $codec->semanticIdentity($next->bridge_record));
    $check($next->bridge_record->source_revision === $refused->bridge_record->source_revision);
    $next->retry_of_mutation_id = $refused->mutation_id;
    $reject(fn() => $codec->validateRoute('V4-02', ['body' => $next]), 'unknown_field');
});
$run('invalid_field remains permanent422 and has no public failure receipt', function () use ($codec, $reject): void {
    $error = (object) ['outcome' => 'rejected', 'code' => 'invalid_field', 'retryable' => false,
        'retry_after_seconds' => null, 'correlation_id' => null, 'core_fallback' => false];
    $codec->validateResponse('V4-02', $error, 422);
    $reject(fn() => $codec->validateResponse('V4-02', $error, 400));
    $wrong = clone $error; $wrong->retryable = true;
    $reject(fn() => $codec->validateResponse('V4-02', $wrong, 422));
    $wrong = clone $error; $wrong->retry_after_seconds = 30;
    $reject(fn() => $codec->validateResponse('V4-02', $wrong, 422));
    $wrong = clone $error; $wrong->rejected_mutation_id = '22222222-2222-4222-8222-222222222222';
    $reject(fn() => $codec->validateResponse('V4-02', $wrong, 422), 'unknown_field');
});

foreach ($failures as $failure) {
    fwrite(STDERR, 'FAIL ' . $failure . PHP_EOL);
}
echo 'PHP ' . PHP_VERSION . ': ' . $passed . ' passed, ' . count($failures) . ' failed; '
    . count($examples) . ' V4 author positives; 36 typed route envelopes; offline only.' . PHP_EOL;
exit(count($failures) === 0 ? 0 : 1);
