<?php
declare(strict_types=1);

$mode=$argv[1]??'';
if (!in_array($mode,['absent','host-before','host-after','cold-host','two-copies','conflicting-copy'],true)) throw new RuntimeException('Unknown coexistence case');
$fixture=__DIR__.'/fixtures/composer';
$checks=0;
function check(bool $condition,string $message): void {
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    ++$checks;
}
function hostEngine(): object {
    global $fixture;
    if (!class_exists('Composer\\Autoload\\ClassLoader',false)) require $fixture.'/ClassLoader.php';
    $loader=new \Composer\Autoload\ClassLoader($fixture.'/virtual-host-vendor');
    $loader->addClassMap(['Composer\\InstalledVersions'=>$fixture.'/InstalledVersions.php']);
    $loader->register(true);
    return $loader;
}
function hostData(): void {
    \Composer\InstalledVersions::reload([
        'root'=>['name'=>'host/root','version'=>'1.0.0.0','pretty_version'=>'1.0.0','reference'=>null,'type'=>'project','install_path'=>__DIR__,'aliases'=>[],'dev'=>false],
        'versions'=>['host/sentinel'=>['version'=>'1.2.3.0','pretty_version'=>'1.2.3','reference'=>'fixture-only','type'=>'library','install_path'=>__DIR__,'aliases'=>[],'dev_requirement'=>false]],
    ]);
}
function checkHost(): void {
    $names=\Composer\InstalledVersions::getInstalledPackages();
    sort($names);
    check($names===['host/sentinel'],'Private package metadata leaked into host Composer');
    check(\Composer\InstalledVersions::getPrettyVersion('host/sentinel')==='1.2.3','Host Composer version changed');
    foreach (['rowbot/idna','rowbot/punycode','discussionbridge/cms-v4-idna'] as $name) check(!\Composer\InstalledVersions::isInstalled($name),'Private package falsely advertised globally');
}
check(!class_exists('Composer\\InstalledVersions',false),'Isolated child unexpectedly has Composer');
if ($mode==='host-before'||$mode==='cold-host') {
    $host=hostEngine();
    check(!class_exists('Composer\\InstalledVersions',false),'Host class was prematurely preloaded');
    if ($mode==='host-before') { check(class_exists('Composer\\InstalledVersions'),'Actual Composer fixture did not load');hostData();checkHost(); }
}
require __DIR__.'/../src/php/CmsCodec.php';
$codec=new \DiscussionBridge\CmsV4\Codec(__DIR__.'/../src/cms-schema.json');
check($codec->validate('Url','https://é.example/Original%2F?Q=%2F')==='https://é.example/Original%2F?Q=%2F','Private URL validation changed source bytes');
if ($mode==='two-copies') {
    if (!isset($argv[2])) throw new RuntimeException('Expected owned second private bundle');
    require $argv[2].'/vendor/autoload.php';
}
if ($mode==='conflicting-copy') {
    try { require $argv[2].'/vendor/autoload.php';throw new RuntimeException('Different private runtime was mixed'); }
    catch (RuntimeException $error) { check($error->getMessage()==='Different private IDNA runtime already loaded','Incorrect mixed-runtime refusal'); }
    check($codec->validate('Url','https://é.example/')==='https://é.example/','Original private runtime was damaged');
}
if (in_array($mode,['absent','host-after','two-copies','conflicting-copy'],true)) {
    for ($i=0;$i<3;++$i) check(!class_exists('Composer\\InstalledVersions'),'Private loader intercepted global Composer');
    check(!class_exists('Composer\\Autoload\\ClassLoader',false),'Private bootstrap installed global Composer engine');
}
if ($mode==='host-after') { $host=hostEngine();check(class_exists('Composer\\InstalledVersions'),'Later host Composer failed');hostData(); }
if ($mode==='cold-host') { check(class_exists('Composer\\InstalledVersions'),'Registered cold host fallback failed');hostData(); }
if (in_array($mode,['host-before','host-after','cold-host'],true)) {
    for ($i=0;$i<3;++$i) check(class_exists('Composer\\InstalledVersions'),'Existing host Composer disappeared');
    checkHost();
}
check(class_exists('DiscussionBridge\\CmsV4\\IdnaVendor\\Composer\\InstalledVersions'),'Private helper class/map mismatch');
check(in_array('rowbot/idna',\DiscussionBridge\CmsV4\IdnaVendor\Composer\InstalledVersions::getInstalledPackages(),true),'Private helper lost its own metadata');
if (in_array($mode,['host-before','host-after','cold-host'],true)) checkHost();
else for ($i=0;$i<3;++$i) check(!class_exists('Composer\\InstalledVersions'),'Private helper exposed a global class');
echo json_encode(['mode'=>$mode,'checks'=>$checks,'host_fixture'=>'Unmodified Composer2.8.1 class bodies; synthetic host package data through its real public reload API','result'=>'isolated'],JSON_THROW_ON_ERROR).PHP_EOL;
