[CmdletBinding()]
param([string]$OutputName)
$ErrorActionPreference = 'Stop'

$contractRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$current = Get-Content -LiteralPath (Join-Path $contractRoot 'CURRENT_CORE_CONTRACT.json') -Raw | ConvertFrom-Json
$extension = Get-Content -LiteralPath (Join-Path $contractRoot $current.extension) -Raw | ConvertFrom-Json
$base = Get-Content -LiteralPath (Join-Path $contractRoot $current.base) -Raw | ConvertFrom-Json
if ($current.version -ne $extension.version -or $current.status -ne 'build_candidate' -or
    $extension.base_version -ne $base.version -or $current.historical_release_is_current_implementation_authority -ne $true -or
    $current.cms_candidate -ne 'cms-publication-candidate.json') {
    throw 'Inconsistent contract candidate declaration'
}
$cms = Get-Content -LiteralPath (Join-Path $contractRoot 'cms-publication-candidate.json') -Raw | ConvertFrom-Json
$release = Get-Content -LiteralPath (Join-Path $contractRoot 'release.json') -Raw | ConvertFrom-Json
if ($cms.implementation_version -ne $current.version -or $cms.status -ne 'build_candidate' -or $cms.wire_version -ne 'v2') {
    throw 'Inconsistent CMS build candidate declaration'
}
foreach ($member in $release.approved_packet) {
    $packetPath = [IO.Path]::GetFullPath((Join-Path $contractRoot $member.path))
    $packetRoot = [IO.Path]::GetFullPath((Join-Path $contractRoot 'approved-packet'))
    if (-not $packetPath.StartsWith($packetRoot + [IO.Path]::DirectorySeparatorChar) -or
        ((Get-Item -LiteralPath $packetPath).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Unsafe approved packet member'
    }
    $packetBytes = [IO.File]::ReadAllBytes($packetPath)
    $packetHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($packetBytes)).ToLowerInvariant()
    if ($packetBytes.Length -ne $member.bytes -or $packetHash -ne $member.sha256) {
        throw 'Immutable approved packet identity mismatch'
    }
}
if (-not $OutputName) { $OutputName = "discussionbridge-core-contract-$($current.version)-candidate.zip" }
if ($OutputName -notmatch '^[a-zA-Z0-9][a-zA-Z0-9._-]*\.zip$') { throw 'OutputName must be a ZIP filename' }
$outputRoot = [IO.Path]::GetFullPath((Join-Path $contractRoot '.artifacts'))
$output = [IO.Path]::GetFullPath((Join-Path $outputRoot $OutputName))
if (-not $output.StartsWith($outputRoot + [IO.Path]::DirectorySeparatorChar) -or (Test-Path -LiteralPath $output)) {
    throw 'Unsafe or existing output path'
}

$paths = [Collections.Generic.List[string]]::new()
foreach ($single in @('contract.json','CURRENT_CORE_CONTRACT.json','core-publication-extension.json','cms-publication-candidate.json','release.json','README.md','scripts/build-release.ps1','src/cms-contract.mjs','src/cms-runtime.mjs','src/cms-schema.json','tests/core-publication-conformance.test.mjs','tests/cms-publication-conformance.test.mjs')) {
    $paths.Add($single)
}
foreach ($member in $release.approved_packet) { $paths.Add($member.path) }
foreach ($file in Get-ChildItem -LiteralPath (Join-Path $contractRoot 'fixtures') -Recurse -Force) {
    if ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked contract member' }
    if (-not $file.PSIsContainer -and $file.Extension -eq '.json') {
        $paths.Add([IO.Path]::GetRelativePath($contractRoot, $file.FullName).Replace('\','/'))
    }
}
$ordered = $paths.ToArray()
[Array]::Sort($ordered, [StringComparer]::Ordinal)
$bodies = @{}
$members = foreach ($relative in $ordered) {
    $source = [IO.Path]::GetFullPath((Join-Path $contractRoot $relative))
    if (-not $source.StartsWith($contractRoot + [IO.Path]::DirectorySeparatorChar) -or
        ((Get-Item -LiteralPath $source).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unsafe contract member' }
    $body = [IO.File]::ReadAllBytes($source)
    $bodies[$relative] = $body
    [ordered]@{ path=$relative; bytes=$body.Length; sha256=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($body)).ToLowerInvariant() }
}
$utf8 = [Text.UTF8Encoding]::new($false)
$provenance = [ordered]@{ format=1; component='discussionbridge-core-contract'; version=$current.version; status='candidate'; cms_wire='v2'; cms_routes='V2-01 through V2-32'; excluded=@('Operator Service','Network','Workspace','Federation','unfrozen URL transport amendment'); immutable_packet_role='Source metadata; only the confirmed CMS subset is exposed'; members=@($members) }
$bodies['SOURCE_MANIFEST.json'] = $utf8.GetBytes(($provenance | ConvertTo-Json -Depth 6) + "`n")
$ordered = [string[]]@($bodies.Keys)
[Array]::Sort($ordered, [StringComparer]::Ordinal)
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$stream = [IO.File]::Open($output, [IO.FileMode]::CreateNew)
try {
    $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create, $true, $utf8)
    try {
        foreach ($relative in $ordered) {
            $entry = $archive.CreateEntry('discussionbridge-core-contract/' + $relative, [IO.Compression.CompressionLevel]::Optimal)
            $entry.LastWriteTime = [DateTimeOffset]::new(1980,1,1,0,0,0,[TimeSpan]::Zero)
            $entry.ExternalAttributes = 0
            $entryStream = $entry.Open()
            try { $entryStream.Write($bodies[$relative],0,$bodies[$relative].Length) }
            finally { $entryStream.Dispose() }
        }
    } finally { $archive.Dispose() }
} finally { $stream.Dispose() }
[ordered]@{ path=$output; version=$current.version; status='candidate'; members=$ordered.Length; sha256=(Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant() } | ConvertTo-Json
