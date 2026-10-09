// lib/collect.js のテスト(AC-8・AC-9・FR-5・INV-10)。
// 実行: research-tabs のフォルダで `node --test test/`
import test from "node:test";
import assert from "node:assert/strict";
import { chooseDefaultMode, classifyTabs } from "../lib/collect.js";

const tab = (index, url, title = `T${index}`, highlighted = false) => ({ id: 100 + index, index, url, title, highlighted });

const AC8 = [
	tab(0, "chrome://newtab/"),
	tab(1, "about:blank"),
	{ id: 102, index: 2, title: "url 無し", highlighted: false },
	tab(3, "chrome://settings"),
	tab(4, "file:///C:/a.txt"),
	tab(5, "view-source:https://a.example/"),
	tab(6, "http://[壊れた"),
	tab(7, "https://example.com/same"),
	tab(8, "https://example.com/same"),
	tab(9, "https://example.com/page#a"),
	tab(10, "https://example.com/page#b"),
	tab(11, "https://example.org/"),
];

const countBy = (xs) => xs.reduce((m, x) => ({ ...m, [x.reason]: (m[x.reason] ?? 0) + 1 }), {});

test("AC-8: 合成のタブ 12 件 → 空 3・http/https 以外 4・重複 1・対象 4", () => {
	const { targets, excluded } = classifyTabs(AC8);
	assert.deepEqual(countBy(excluded), { empty: 3, scheme: 4, duplicate: 1 });
	assert.equal(targets.length, 4);
	assert.deepEqual(
		targets.map((t) => t.index),
		[7, 9, 10, 11],
		"重複は左を残し、# だけ違う 2 件は両方残す",
	);
	assert.equal(excluded.find((x) => x.reason === "duplicate").index, 8);
});

test("AC-8: 除いた物は理由と元のタイトル・URL を持つ", () => {
	const { excluded } = classifyTabs(AC8);
	assert.deepEqual(excluded[0], { tabId: 100, index: 0, title: "T0", url: "chrome://newtab/", reason: "empty" });
	assert.deepEqual(excluded[2], { tabId: 102, index: 2, title: "url 無し", url: "", reason: "empty" });
});

test("INV-10: どの入力でも 対象 + 除いた物 = 入力の件数(乱数 200 回)", () => {
	const urls = ["", "about:blank", "chrome://newtab/x", "https://a.example/", "https://a.example/#x", "http://b.example/", "ftp://c/", "%%", undefined, null];
	let seed = 7;
	const rnd = (n) => ((seed = (seed * 1103515245 + 12345) % 2147483648) % n);
	for (let i = 0; i < 200; i++) {
		const tabs = Array.from({ length: rnd(15) }, (_, j) => ({ id: j, index: j, url: urls[rnd(urls.length)], title: rnd(2) ? "t" : "" }));
		const r = classifyTabs(tabs);
		assert.equal(r.targets.length + r.excluded.length, tabs.length);
	}
	assert.deepEqual(classifyTabs([]), { targets: [], excluded: [] });
});

test("重複の判定は new URL の href で、左は index の順", () => {
	const r = classifyTabs([tab(1, "https://EXAMPLE.com/a"), tab(0, "https://example.com/a")]);
	assert.deepEqual(r.targets.map((t) => t.index), [0]);
	assert.equal(r.excluded[0].index, 1);
	assert.equal(r.targets[0].url, "https://example.com/a", "出力の URL はタブの url のまま");
});

test("http: は対象", () => {
	assert.equal(classifyTabs([tab(0, "http://example.com/")]).targets.length, 1);
});

test("FR-5: 画面の題(label)は改行・タブ・制御文字を空白 1 つにし、前後を取る。空か URL と同じならタイトル無しで URL を使う。title はタブのまま(1-3)", () => {
	const u = "https://example.com/a";
	const r = classifyTabs([tab(0, u, " 一行目\r\n二行目\tです\u0007 "), tab(1, u + "1", ""), tab(2, u + "2", " \t\n "), tab(3, u + "3", u + "3"), { id: 4, index: 4, url: u + "4" }, tab(5, u + "5", "example.com/a5")]);
	assert.equal(r.targets[0].title, " 一行目\r\n二行目\tです\u0007 ", "出典行に渡す題は手を加えない");
	assert.deepEqual(
		r.targets.map((t) => [t.label, t.titleMissing]),
		[
			["一行目 二行目 です", false],
			[u + "1", true],
			[u + "2", true],
			[u + "3", true],
			[u + "4", true],
			[u + "5", true], // タイトルの無いページで Chrome が付ける題(スキームを除いた URL)
		],
	);
});

test("タイトル無しの判定は出典行の代わりの題(SourceStamp (b) 4、FORMAT_VERSION 2)と同じ", () => {
	const r = classifyTabs([tab(0, "http://localhost:8799/", "localhost:8799"), tab(1, "https://example.com/a", "　　"), tab(2, "https://example.com/b", "example.com のトップ")]);
	assert.deepEqual(
		r.targets.map((t) => [t.label, t.titleMissing]),
		[
			["http://localhost:8799/", true], // ホストだけなら Chrome は末尾の / も省く
			["https://example.com/a", true], // 全角空白だけ
			["example.com のトップ", false],
		],
	);
});

test("AC-9: chooseDefaultMode は highlighted 2 件以上で selected、1 件・0 件で window", () => {
	assert.equal(chooseDefaultMode([tab(0, "a", "", true), tab(1, "b", "", true), tab(2, "c")]), "selected");
	assert.equal(chooseDefaultMode([tab(0, "a", "", true), tab(1, "b")]), "window");
	assert.equal(chooseDefaultMode([tab(0, "a")]), "window");
});
