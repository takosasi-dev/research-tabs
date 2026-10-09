// lib/format.js(SourceStamp の写しへの窓口)のテスト。Phase 4 の AC-17 と、AC-10 を §8.6 の例(SourceStamp 仕様書 §9.1 (h))に置き換えた物。
// 実行: research-tabs のフォルダで `node --test test/`
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { classifyTabs } from "../lib/collect.js";
import { formatSourceLine } from "../lib/format.js";
import { buildDocument } from "../lib/document.js";
import { formatSourceLine as sourceStamp } from "../lib/sourcestamp/format.js";

// §8.6 SOURCESTAMP_SHA256 の仮の値(写した 2026-10-06 の sourcestamp/format.js。NOTES.md)
const SOURCESTAMP_SHA256 = "86e9f95b597b0311f24308584e104f482c70f8c6893dac5477c93221f05fe6f0";

test("AC-17: lib/sourcestamp/format.js の SHA-256 が §8.6 の値と一致する(改変していない)", () => {
	const bytes = readFileSync(new URL("../lib/sourcestamp/format.js", import.meta.url));
	assert.equal(createHash("sha256").update(bytes).digest("hex"), SOURCESTAMP_SHA256);
});

// タブ 1 つ → classifyTabs → formatSourceLine(popup と同じ流れ)
const viaPopup = (title, url) => {
	const { targets } = classifyTabs([{ id: 1, index: 0, title, url }]);
	assert.equal(targets.length, 1, url);
	return formatSourceLine({ ...targets[0], date: "2026-10-06" });
};

// SourceStamp 仕様書 §9.1 (h) の見本表(bullet true・includeDate false・stripParams utm_*。窓口の既定と同じ)
const V = [
	["V-1", "Example Domain", "https://example.com/", "- [Example Domain](https://example.com/)"],
	["V-2", "Array[0] と [[x]]", "https://example.com/a", "- [Array\\[0\\] と \\[\\[x\\]\\]](https://example.com/a)"],
	["V-3", "C:\\temp の話", "https://example.com/a", "- [C:\\\\temp の話](https://example.com/a)"],
	["V-4", "  一行目\n二行目\tです  ", "https://example.com/a", "- [一行目 二行目 です](https://example.com/a)"],
	["V-5", "", "https://example.com/docs/intro/", "- [example.com/docs/intro](https://example.com/docs/intro/)"],
	["V-6", "https://example.com/", "https://example.com/", "- [example.com](https://example.com/)"],
	["V-7", "", "https://ja.wikipedia.org/wiki/%E6%97%A5%E6%9C%AC", "- [ja.wikipedia.org/wiki/日本](https://ja.wikipedia.org/wiki/%E6%97%A5%E6%9C%AC)"],
	["V-8", "T", "https://example.com/a?utm_source=x&id=3&utm_medium=y#top", "- [T](https://example.com/a?id=3#top)"],
	["V-9", "T", "https://example.com/a?utm_source=x", "- [T](https://example.com/a)"],
	["V-10", "T", "https://example.com/a?q=a+b&UTM_Campaign=z", "- [T](https://example.com/a?q=a+b)"],
	["V-11", "T", "https://example.com/a?x=1&&utm_term=t", "- [T](https://example.com/a?x=1)"],
	["V-12", "T", "https://example.com/a?q=%20&&x=utm_source", "- [T](https://example.com/a?q=%20&&x=utm_source)"],
	["V-13", "Rust", "https://en.wikipedia.org/wiki/Rust_(programming_language)", "- [Rust](https://en.wikipedia.org/wiki/Rust_(programming_language))"],
	["V-14", "T", "https://example.com/a)b", "- [T](https://example.com/a%29b)"],
];

for (const [id, title, url, expected] of V) {
	test(`§8.6 ${id}: ${JSON.stringify(title)} / ${url}`, () => {
		assert.equal(formatSourceLine({ title, url, date: "2026-10-06" }), expected, "窓口に直接");
		assert.equal(viaPopup(title, url), expected, "popup と同じ流れ");
	});
}

test("§8.6 V-15・FR-16: SourceStamp が行を作れない URL は例外(黙って既定の書式にしない)", () => {
	assert.throws(() => formatSourceLine({ title: "T", url: "file:///E:/a.pdf" }), /unsupported-scheme/);
	assert.throws(() => formatSourceLine({ title: "T", url: "壊れた" }), /invalid-url/);
});

// SourceStamp の sw.js はタブの題に手を加えず既定の設定で formatSourceLine を呼ぶ。同じタブなら同じ行になること
test("1-3: 全角空白・制御文字・前後の空白のある題でも、popup の流れの行が SourceStamp と同じ", () => {
	const url = "https://example.com/a";
	const zen = String.fromCharCode(0x3000); // 全角空白(見えないので文字で書かない)
	const nbsp = String.fromCharCode(0xa0);
	for (const title of [`${zen}全角の空白${zen}`, "a\u0007b", "  前後  ", "一行目\r\n二行目", `${nbsp}A${nbsp}`, "", "example.com/a"]) {
		assert.equal(viaPopup(title, url), sourceStamp({ title, url }).line, JSON.stringify(title));
	}
});

test("AC-10(§8.6 版): タイトルが空・空白だけ・URL と同じ・スキーム抜きの URL と同じで `[](` が出ない(INV-7)", () => {
	for (const [title, url] of [
		["", "https://example.com/1"],
		["  \t ", "https://example.com/2"],
		["https://example.com/3", "https://example.com/3"],
		["example.com/4", "https://example.com/4"],
	]) {
		const line = viaPopup(title, url);
		assert.ok(!line.includes("[]("), line);
		assert.ok(line.startsWith("- [example.com/"), line);
	}
});

test("AC-10(§8.6 版): §9.4 の例の 4 行は SourceStamp の書式では括弧と代わりの題が変わる", () => {
	const lines = [
		["Chrome でタブを管理する - パソコン - Google Chrome ヘルプ", "https://support.google.com/chrome/answer/2391819?hl=ja"],
		["配列 [Array] の使い方", "https://example.com/array"],
		["Foo (bar) - Wikipedia", "https://en.wikipedia.org/wiki/Foo_(bar)"],
		["", "https://example.com/a b"],
	].map(([title, url]) => viaPopup(title, url));
	assert.equal(
		buildDocument({ heading: "## 出典", lines }),
		[
			"## 出典",
			"",
			"- [Chrome でタブを管理する - パソコン - Google Chrome ヘルプ](https://support.google.com/chrome/answer/2391819?hl=ja)",
			"- [配列 \\[Array\\] の使い方](https://example.com/array)",
			"- [Foo (bar) - Wikipedia](https://en.wikipedia.org/wiki/Foo_(bar))",
			"- [example.com/a b](https://example.com/a%20b)",
			"",
		].join("\n"),
	);
});
