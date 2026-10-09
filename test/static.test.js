// manifest とソースの静的な検査(AC-3・AC-4・AC-5・AC-6・AC-7 の grep・AC-19・AC-20・INV-6)。仕様書の grep を Node で同じ範囲に当てる。
// このファイル自身が grep に当たらないよう、探す語はつないで作る。
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const j = (...parts) => parts.join("");

function walk(dir) {
	const out = [];
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) out.push(...walk(p));
		else out.push(path.relative(ROOT, p).replaceAll("\\", "/"));
	}
	return out;
}
const FILES = walk(ROOT);
const source = (exts) => FILES.filter((f) => exts.includes(path.extname(f)));

// → [ "rel:行番号", ... ]
function grep(words, exts, skip = () => false) {
	const hits = [];
	for (const rel of source(exts).filter((f) => !skip(f))) {
		readFileSync(path.join(ROOT, rel), "utf8")
			.split("\n")
			.forEach((line, i) => {
				if (words.some((w) => line.includes(w))) hits.push(`${rel}:${i + 1}`);
			});
	}
	return hits;
}

test("AC-3: permissions は tabs・storage(§8.4 で要れば clipboardWrite も)。§9.1 の書かない物が無い", () => {
	const m = JSON.parse(readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
	const perms = JSON.stringify([...m.permissions].sort());
	assert.ok([JSON.stringify(["storage", "tabs"]), JSON.stringify(["clipboardWrite", "storage", "tabs"])].includes(perms), perms);
	const banned = ["host_permissions", "optional_permissions", "content_scripts", "background", "web_accessible_resources", "incognito", "commands"];
	for (const key of banned) assert.equal(key in m, false, key);
	for (const p of ["scripting", "activeTab", "tabGroups", "downloads", "sessions"]) assert.ok(!m.permissions.includes(p), p);
});

test("AC-4: DOM に HTML を入れる書き方が 0 件(INV-5)", () => {
	assert.deepEqual(grep([j("inner", "HTML"), j("outer", "HTML"), j("insertAdjacent", "HTML"), j("document", ".write")], [".js", ".html"]), []);
});

test("AC-5: 通信と外のスクリプトが 0 件(INV-3)", () => {
	const words = [j("fetch", "("), j("XMLHttp", "Request"), j("Web", "Socket"), j("Event", "Source"), j("send", "Beacon"), j("import", "Scripts"), j('src="', "http")];
	assert.deepEqual(grep(words, [".js", ".html"]), []);
});

test("AC-6: タブとウィンドウを変える呼び出しが 0 件。タブの update は popup.js の 1 か所だけ(INV-4)", () => {
	const words = ["remove", "move", "group", "ungroup", "discard", "duplicate", "reload"].map((w) => j("tabs.", w));
	words.push(j("windows.", "remove"));
	assert.deepEqual(grep(words, [".js", ".html"]), []);
	const upd = grep([j("tabs.", "update")], [".js", ".html"]);
	assert.equal(upd.length, 1, upd.join(" "));
	assert.match(upd[0], /^popup\.js:/);
});

test("AC-7: storage への書き込みは lib/settings.js の中だけ。ブラウザの別の保存先が 0 件(INV-2)", () => {
	const set = grep([j("storage.local", ".set")], [".js"]);
	assert.equal(set.length, 1, set.join(" "));
	assert.match(set[0], /^lib\/settings\.js:/);
	assert.deepEqual(grep([j("local", "Storage"), j("indexed", "DB")], [".js", ".html"]), []);
});

test("INV-6: `](` を組み立てるのは lib/format.js(と lib/sourcestamp/)だけ(テストを除く)", () => {
	const hits = grep([j("]", "(")], [".js", ".html"], (f) => f.startsWith("test/") || f === "lib/format.js" || f.startsWith("lib/sourcestamp/"));
	assert.deepEqual(hits, []);
});

test("AC-19: .js と .html(lib/sourcestamp/ を除く)の 1 行目が責務のコメント", () => {
	for (const f of source([".js", ".html"]).filter((f) => !f.startsWith("lib/sourcestamp/"))) {
		const first = readFileSync(path.join(ROOT, f), "utf8").split("\n", 1)[0];
		assert.ok(first.startsWith("//") || first.startsWith("<!--"), f);
	}
});

test("AC-20: package.json に依存が無く、node_modules が無い(INV-9)", () => {
	const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
	assert.deepEqual(pkg, { name: "research-tabs", private: true, type: "module" });
	assert.equal(existsSync(path.join(ROOT, "node_modules")), false);
});
