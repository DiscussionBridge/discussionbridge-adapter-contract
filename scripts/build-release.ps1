param([string]$OutputName)
$ErrorActionPreference = 'Stop'
$contractRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
& node (Join-Path $PSScriptRoot 'generate.mjs') --check
if ($LASTEXITCODE -ne 0) { throw 'V4 candidate derivation check failed' }
$candidate = Get-Content -LiteralPath (Join-Path $contractRoot 'CANDIDATE.json') -Raw | ConvertFrom-Json -Depth 100
if ($candidate.wire_version -ne 'v4' -or $candidate.implementation_version -ne '0.4.0-alpha.1' -or $null -ne $candidate.release_version -or $candidate.status -ne 'implementation_candidate_not_exact_approved_not_frozen') { throw 'Not the current unpublished V4 candidate' }
if (-not $OutputName) { $OutputName = 'discussionbridge-contract-v4-0.4.0-alpha.1-candidate.zip' }
if ([System.IO.Path]::GetFileName($OutputName) -ne $OutputName -or -not $OutputName.EndsWith('.zip')) { throw 'OutputName must be a ZIP basename' }
$artifactRoot = Join-Path $contractRoot '.artifacts'
[System.IO.Directory]::CreateDirectory($artifactRoot) | Out-Null
$output = Join-Path $artifactRoot $OutputName
if (Test-Path -LiteralPath $output) { throw 'Preserve existing artifact: select a distinct OutputName' }
$paths = @(
  'normative/CONTRACT.json','CANDIDATE.json','ARTIFACTS.json','README.md','ROUTES.md',
  'implementation/cms-runtime.mjs.in','implementation/CmsCodec.php.in',
  'scripts/generate.mjs','scripts/build-release.ps1','scripts/php-idna-bundle.mjs','scripts/build-php-idna.mjs',
  'php-dependencies/composer.json','php-dependencies/composer.lock',
  'tools/php-idna/composer.json','tools/php-idna/composer.lock','tools/php-idna/scoper.inc.php',
  'implementation/php-idna-bridge.php.in','implementation/php-idna-autoload.php.in',
  'implementation/js-contextj.js.in','implementation/php-contextj.php.in',
  'scripts/build-js-idna.mjs','scripts/import-unicode-fixtures.mjs','scripts/import-normalization-inputs.mjs',
  'scripts/derive-contextj-regressions.mjs',
  'js-dependencies/package.json','js-dependencies/package-lock.json','js-dependencies/entry.mjs','js-dependencies/nfc.mjs',
  'tools/js-idna/package.json','tools/js-idna/package-lock.json',
  'tools/unicode17/Compiler.php','tools/unicode17/INPUTS.json','tools/unicode17/LICENSE',
  'src/js-idna/DEPENDENCIES.json','src/js-idna/runtime.js','src/js-idna/LICENSES.txt',
  'src/cms-contract.mjs','src/cms-runtime.mjs','src/cms-schema.json',
  'src/php/CmsCodec.php','src/php/README.md','src/php/conformance.php',
  'tests/cms-conformance.test.mjs','tests/v4-behavior.test.mjs','tests/php-generated.php',
  'tests/attention-recovery.test.mjs','tests/php-attention.php','tests/php-runtime.mjs',
  'tests/php-url-parity.test.mjs','tests/php-urls.php',
  'tests/php-dependencies.test.mjs','tests/php-idna-isolation.php','tests/php-idna-portable.php','tests/php-composer-coexistence.php',
  'tests/fixtures/composer/InstalledVersions.php','tests/fixtures/composer/ClassLoader.php','tests/fixtures/composer/LICENSE',
  'tests/php-url-authority.php','tests/php-unicode-corpus.php','tests/unicode-corpus.test.mjs','tests/unicode-fixtures.mjs',
  'tests/php-connection-origins.php','tests/url-regressions.test.mjs',
  'fixtures/positive-examples.json','fixtures/rejection-cases.json','fixtures/numeric-lexemes.json',
  'fixtures/url-numeric-hosts.json',
  'fixtures/url-idna-hosts.json',
  'fixtures/url-domain-policy.json',
  'fixtures/url-contextj.json',
  'fixtures/unicode17/IdnaTestV2.txt','fixtures/unicode17/NormalizationTest.txt','fixtures/unicode17/LICENSE.txt','fixtures/unicode17/PROVENANCE.json',
  'fixtures/unicode17/UnicodeData.txt','fixtures/unicode17/CompositionExclusions.txt','fixtures/unicode17/CaseFolding.txt','fixtures/unicode17/SpecialCasing.txt',
  'fixtures/attention-recovery-regressions.json'
)
$idna = Get-Content -LiteralPath (Join-Path $contractRoot 'src/php/idna/DEPENDENCIES.json') -Raw | ConvertFrom-Json -Depth 100
$paths += @('src/php/idna/DEPENDENCIES.json')
$paths += @($idna.members | ForEach-Object { 'src/php/idna/' + $_.path })
$paths = @($paths | Sort-Object -CaseSensitive)
if (@($paths | Select-Object -Unique).Count -ne $paths.Count) { throw 'Duplicate candidate source member' }
$members = foreach ($memberPath in $paths) {
  $absolute = Join-Path $contractRoot $memberPath
  $bytes = [System.IO.File]::ReadAllBytes($absolute)
  [ordered]@{ path=$memberPath; bytes=$bytes.Length; sha256=(Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash.ToLowerInvariant() }
}
$manifest = [ordered]@{
  format=1; component='discussionbridge-v4-core-contract'; candidate_id=$candidate.candidate_id;
  implementation_version=$candidate.implementation_version; wire_version='v4';
  status=$candidate.status; release_version=$null;
  normative=$candidate.normative; excluded=@('earlier development/deployment compatibility','Operator Service','Network','Workspace','Federation','unfrozen URL transport amendment');
  members=@($members)
}
$utf8 = [System.Text.UTF8Encoding]::new($false)
$manifestBytes = $utf8.GetBytes(($manifest | ConvertTo-Json -Depth 100) + "`n")
Add-Type -AssemblyName System.IO.Compression
$stream = [System.IO.File]::Open($output,[System.IO.FileMode]::CreateNew)
try {
  $zip = [System.IO.Compression.ZipArchive]::new($stream,[System.IO.Compression.ZipArchiveMode]::Create,$false)
  try {
    foreach ($memberPath in $paths) {
      $entry = $zip.CreateEntry($memberPath,[System.IO.Compression.CompressionLevel]::Optimal)
      $entry.LastWriteTime = [DateTimeOffset]::new(2026,10,14,0,0,0,[TimeSpan]::Zero)
      $entryStream = $entry.Open()
      try { $bytes = [System.IO.File]::ReadAllBytes((Join-Path $contractRoot $memberPath)); $entryStream.Write($bytes,0,$bytes.Length) } finally { $entryStream.Dispose() }
    }
    $entry = $zip.CreateEntry('SOURCE_MANIFEST.json',[System.IO.Compression.CompressionLevel]::Optimal)
    $entry.LastWriteTime = [DateTimeOffset]::new(2026,10,14,0,0,0,[TimeSpan]::Zero)
    $entryStream = $entry.Open()
    try { $entryStream.Write($manifestBytes,0,$manifestBytes.Length) } finally { $entryStream.Dispose() }
  } finally { $zip.Dispose() }
} finally { $stream.Dispose() }
$sha = [System.Security.Cryptography.SHA256]::Create()
try {
  $readStream = [System.IO.File]::OpenRead($output)
  try {
    $readZip = [System.IO.Compression.ZipArchive]::new($readStream,[System.IO.Compression.ZipArchiveMode]::Read,$false)
    try {
      $expectedNames = @($paths) + @('SOURCE_MANIFEST.json')
      $actualNames = @($readZip.Entries | ForEach-Object { $_.FullName })
      if ($actualNames.Count -ne $expectedNames.Count -or @($actualNames | Select-Object -Unique).Count -ne $actualNames.Count) { throw 'Unexpected/duplicate candidate ZIP members' }
      foreach ($name in $expectedNames) { if ($actualNames -cnotcontains $name) { throw 'Missing candidate ZIP member' } }
      foreach ($member in $members) {
        $entryStream = $readZip.GetEntry($member.path).Open()
        $memory = [System.IO.MemoryStream]::new()
        try { $entryStream.CopyTo($memory); $bytes = $memory.ToArray() } finally { $entryStream.Dispose(); $memory.Dispose() }
        $sourceBytes = [System.IO.File]::ReadAllBytes((Join-Path $contractRoot $member.path))
        $archiveHash = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()
        if ($bytes.Length -ne $member.bytes -or $archiveHash -cne $member.sha256 -or [Convert]::ToBase64String($bytes) -cne [Convert]::ToBase64String($sourceBytes)) { throw 'Candidate ZIP/source/provenance byte mismatch' }
      }
      $entryStream = $readZip.GetEntry('SOURCE_MANIFEST.json').Open()
      $memory = [System.IO.MemoryStream]::new()
      try { $entryStream.CopyTo($memory); $archiveManifest = $memory.ToArray() } finally { $entryStream.Dispose(); $memory.Dispose() }
      if ([Convert]::ToBase64String($archiveManifest) -cne [Convert]::ToBase64String($manifestBytes)) { throw 'Candidate manifest byte mismatch' }
      $manifestHash = [BitConverter]::ToString($sha.ComputeHash($manifestBytes)).Replace('-','').ToLowerInvariant()
    } finally { $readZip.Dispose() }
  } finally { $readStream.Dispose() }
} finally { $sha.Dispose() }
[ordered]@{path=$output;wire_version='v4';implementation_version=$candidate.implementation_version;status=$candidate.status;release_version=$null;members=$paths.Count+1;source_members_verified=$paths.Count;manifest_sha256=$manifestHash;bytes=(Get-Item -LiteralPath $output).Length;sha256=(Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant()} | ConvertTo-Json
