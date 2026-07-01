// リリース手順を 1 コマンドにまとめるスクリプト。
// `npm run release`（本番）/ `npm run release -- --dry-run`（確認のみ）で実行する。
//
// やること（順に）：
//   1. package.json の version を正としてタグ名（v{version}）を決める
//   2. 事前チェック（main ブランチ・作業ツリーがクリーン・タグ未存在）
//   3. deploy.yml の VERSIONS/LATEST と index.html のヒーロー版表示を更新
//   4. 進化の記録（index.html）と step3-feedback.html への未反映を警告（中断しない）
//   5. commit → tag → git push origin main + tag（--dry-run のときは何もせず差分表示）
//
// バージョンのバンプはしない（package.json を先に新版へ上げておく前提）。
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const DRY_RUN = process.argv.includes("--dry-run");

const DEPLOY_YML = ".github/workflows/deploy.yml";
const INDEX_HTML = "docs/site/index.html";
const STEP3_HTML = "docs/site/step3-feedback.html";

/** 標準出力ヘルパ（日本語メッセージ用） */
const log = (msg) => console.log(msg);
/** エラーを表示して終了する */
function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

/** git コマンドを実行して標準出力（トリム済み）を返す */
function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

// --- 1. バージョン取得 ---------------------------------------------------
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const version = pkg.version;
if (!version) fail("package.json に version がありません。");
const tag = `v${version}`;
log(`リリース対象：${tag}（package.json の version が正）`);
if (DRY_RUN) log("※ --dry-run：ファイル変更・commit・tag・push は一切行いません。");

// --- 2. 事前チェック -----------------------------------------------------
const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
if (branch !== "main") {
  fail(`カレントブランチが main ではありません（現在: ${branch}）。deploy は main で起動します。`);
}

const dirty = git(["status", "--porcelain"]);
if (dirty) {
  fail(
    "未コミットの変更があります。先にコミットしてから実行してください。\n" +
      "（このスクリプトは deploy.yml と index.html の版表示のみを変更・コミットします）\n---\n" +
      dirty,
  );
}

// ローカルにタグがあるか
const localTags = git(["tag", "-l", tag]);
if (localTags) fail(`タグ ${tag} は既にローカルに存在します。version を上げてから実行してください。`);
// リモートにタグがあるか
const remoteTags = git(["ls-remote", "--tags", "origin", tag]);
if (remoteTags) fail(`タグ ${tag} は既にリモート（origin）に存在します。version を上げてから実行してください。`);

// --- 3. ファイル更新（対象行だけ置換） -----------------------------------
/** 変更内容のログ蓄積 */
const changes = [];

// deploy.yml: VERSIONS 追記 + LATEST 置換
let deployYml = readFileSync(DEPLOY_YML, "utf8");

// VERSIONS="...": 末尾に " v{version}" を追記（既に含むなら何もしない）
const versionsRe = /^(\s*VERSIONS=")([^"]*)(")/m;
const mv = deployYml.match(versionsRe);
if (!mv) fail(`${DEPLOY_YML} に VERSIONS="..." 行が見つかりません。`);
const versionsList = mv[2].split(/\s+/).filter(Boolean);
if (versionsList.includes(tag)) {
  log(`・deploy.yml VERSIONS: 既に ${tag} を含みます（変更なし）`);
} else {
  deployYml = deployYml.replace(versionsRe, `$1$2 ${tag}$3`);
  changes.push(`deploy.yml VERSIONS に ${tag} を追記`);
}

// LATEST="...": v{version} に置換
const latestRe = /^(\s*LATEST=")([^"]*)(")/m;
const ml = deployYml.match(latestRe);
if (!ml) fail(`${DEPLOY_YML} に LATEST="..." 行が見つかりません。`);
if (ml[2] === tag) {
  log(`・deploy.yml LATEST: 既に ${tag}（変更なし）`);
} else {
  deployYml = deployYml.replace(latestRe, `$1${tag}$3`);
  changes.push(`deploy.yml LATEST を ${ml[2]} → ${tag} に変更`);
}

// index.html: ヒーローの版表示 <span class="ver">v...</span> を置換
let indexHtml = readFileSync(INDEX_HTML, "utf8");
const verSpanRe = /(<span class="ver">)v[0-9]+\.[0-9]+\.[0-9]+(<\/span>)/;
const ms = indexHtml.match(verSpanRe);
if (!ms) fail(`${INDEX_HTML} に <span class="ver">v...</span>（ヒーロー版表示）が見つかりません。`);
const currentHeroVer = ms[0].replace(/<[^>]+>/g, "");
if (currentHeroVer === tag) {
  log(`・index.html ヒーロー版表示: 既に ${tag}（変更なし）`);
} else {
  indexHtml = indexHtml.replace(verSpanRe, `$1${tag}$2`);
  changes.push(`index.html ヒーロー版表示を ${currentHeroVer} → ${tag} に変更`);
}

// --- 4. 説明文の未反映を警告（中断しない） -------------------------------
const warnings = [];
// 進化の記録（VERSIONS 配列）に '{version}' があるか
if (!indexHtml.includes(`'${version}'`)) {
  warnings.push(`index.html の「進化の記録」VERSIONS 配列に ${tag} の行がありません（説明文は手動で追記してください）。`);
}
// step3-feedback.html に v{version} があるか
const step3Html = readFileSync(STEP3_HTML, "utf8");
if (!step3Html.includes(tag)) {
  warnings.push(`${STEP3_HTML} に ${tag} の記載がありません（フィードバック詳細は手動で追記してください）。`);
}

// --- 5. dry-run なら差分表示して終了 -------------------------------------
log("\n--- 変更予定 ---");
if (changes.length === 0) {
  log("（版表示の変更はありません。すべて最新です）");
} else {
  changes.forEach((c) => log(`  ・${c}`));
}
log(`  ・タグ ${tag} を HEAD に作成`);
log("  ・git push origin main → git push origin " + tag);

if (warnings.length > 0) {
  log("\n--- ⚠ 警告（説明文の未反映。公開はできますが手動追記を推奨） ---");
  warnings.forEach((w) => log(`  ⚠ ${w}`));
}

if (DRY_RUN) {
  log("\n※ --dry-run のため、ここで終了します（何も変更していません）。");
  process.exit(0);
}

// --- 6. ファイル書き込み → commit → tag → push --------------------------
writeFileSync(DEPLOY_YML, deployYml);
writeFileSync(INDEX_HTML, indexHtml);

if (changes.length > 0) {
  git(["add", DEPLOY_YML, INDEX_HTML]);
  git(["commit", "-m", `リリース: ${tag} を公開対象に追加（VERSIONS/LATEST・トップ版表示）`]);
  log(`\n✔ コミットしました：リリース ${tag}`);
} else {
  log("\n（版表示に変更がないためコミットはスキップします）");
}

git(["tag", tag]);
log(`✔ タグを作成しました：${tag}`);

git(["push", "origin", "main"]);
git(["push", "origin", tag]);
log(`✔ push しました（main + ${tag}）。GitHub Actions のデプロイが起動します。`);

// --- 7. 完了メッセージ ---------------------------------------------------
log("\n=== 完了 ===");
log("Actions: https://github.com/mrgarita/snoot/actions");
log(`公開URL: https://mrgarita.github.io/snoot/play/${tag}/`);
log("最新版:  https://mrgarita.github.io/snoot/play/latest/");
if (warnings.length > 0) {
  log("\n⚠ 未反映の説明文（上記警告）を忘れずに追記してください。");
}
