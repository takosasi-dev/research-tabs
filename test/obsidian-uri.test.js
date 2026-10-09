// lib/obsidian-uri.js のテスト(AC-12・AC-13・INV-8・FR-12)。
// 実行: research-tabs のフォルダで `node --test test/`
import test from "node:test";
import assert from "node:assert/strict";
import { buildNewNoteUri, validateNamePart } from "../lib/obsidian-uri.js";

const EXAMPLE = {
	vaultName: "Claude",
	baseFolder: "レポート/調査レポート",
	topic: "ブラウザ調査",
	fileName: "2026-09-26_ブラウザ調査_出典",
};

test("AC-12: §9.5 の例と一致する", () => {
	assert.equal(
		buildNewNoteUri(EXAMPLE),
		"obsidian://new?vault=Claude&file=%E3%83%AC%E3%83%9D%E3%83%BC%E3%83%88%2F%E8%AA%BF%E6%9F%BB%E3%83%AC%E3%83%9D%E3%83%BC%E3%83%88%2F%E3%83%96%E3%83%A9%E3%82%A6%E3%82%B6%E8%AA%BF%E6%9F%BB%2F2026-09-26_%E3%83%96%E3%83%A9%E3%82%A6%E3%82%B6%E8%AA%BF%E6%9F%BB_%E5%87%BA%E5%85%B8&clipboard",
	);
});

const names = (uri) => [...new URL(uri).searchParams.keys()];

test("AC-12: 引数の名前は clipboard なら vault・file・clipboard(と silent)だけ", () => {
	assert.deepEqual(names(buildNewNoteUri(EXAMPLE)), ["vault", "file", "clipboard"]);
	assert.deepEqual(names(buildNewNoteUri({ ...EXAMPLE, silent: true })), ["vault", "file", "clipboard", "silent"]);
	assert.ok(buildNewNoteUri({ ...EXAMPLE, silent: true }).endsWith("&clipboard&silent"), "値を付けずに置く");
});

test("AC-12: content なら vault・file・content(と silent)だけで、中身が戻る", () => {
	const content = "- [a](https://example.com/?x=1&y=2)\n- [b c](https://example.com/#z)\n";
	const uri = buildNewNoteUri({ ...EXAMPLE, mode: "content", content });
	assert.deepEqual(names(uri), ["vault", "file", "content"]);
	assert.equal(new URL(uri).searchParams.get("content"), content);
	assert.deepEqual(names(buildNewNoteUri({ ...EXAMPLE, mode: "content", content, silent: true })), ["vault", "file", "content", "silent"]);
});

test("AC-12: vaultName が空なら例外(INV-8)", () => {
	assert.throws(() => buildNewNoteUri({ ...EXAMPLE, vaultName: "" }));
	assert.throws(() => buildNewNoteUri({ ...EXAMPLE, vaultName: undefined }));
});

test("INV-8: overwrite・append・path を付けない。vault と file は encodeURIComponent", () => {
	const uri = buildNewNoteUri({ vaultName: "My Vault", baseFolder: "a b", topic: "t&x", fileName: "f=1" });
	assert.equal(uri, "obsidian://new?vault=My%20Vault&file=a%20b%2Ft%26x%2Ff%3D1&clipboard");
	for (const bad of ["overwrite", "append", "path"]) assert.ok(!names(uri).includes(bad));
});

test("AC-13: validateNamePart は a/b・a:b・a#b・a]・前後の空白・末尾の . を駄目にする", () => {
	for (const s of ["a/b", "a:b", "a#b", "a]", " a", "a.", "a ", 'a"b', "a|b", "a^b", "a[b", "a\\b", "a*b", "a?b", "a<b", "a>b"]) {
		assert.equal(validateNamePart(s).ok, false, s);
	}
	assert.deepEqual(validateNamePart("a/b:c/"), { ok: false, badChars: ["/", ":"] });
	assert.deepEqual(validateNamePart(" a."), { ok: false, badChars: ["前後の空白", "末尾の ."] });
});

test("AC-13: ブラウザ調査・2026-09-26_話題_出典 は通す。空は通さない", () => {
	assert.deepEqual(validateNamePart("ブラウザ調査"), { ok: true });
	assert.deepEqual(validateNamePart("2026-09-26_話題_出典"), { ok: true });
	assert.deepEqual(validateNamePart(""), { ok: false, badChars: [] });
});
