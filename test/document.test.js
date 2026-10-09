// lib/document.js のテスト(AC-11・FR-8)。
// 実行: research-tabs のフォルダで `node --test test/`
import test from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../lib/document.js";

test("AC-11: 見出しありなら 見出し・空行・行。末尾は改行 1 つ", () => {
	assert.equal(buildDocument({ heading: "## 出典", lines: ["- a", "- b"] }), "## 出典\n\n- a\n- b\n");
});

test("AC-11: 見出しが空なら行から始まる。末尾は改行 1 つ", () => {
	assert.equal(buildDocument({ heading: "", lines: ["- a", "- b"] }), "- a\n- b\n");
});
