// lib/settings.js のテスト(AC-7・INV-2・§9.2)。chrome は globalThis に置いた偽物で代える。
// 実行: research-tabs のフォルダで `node --test test/`
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, normalizeSettings, loadSettings, saveSettings } from "../lib/settings.js";

const KEYS = ["vaultName", "baseFolder", "heading", "openAfterCreate", "lastTopic"];

test("AC-7: 未知の項目 urls を捨て、§9.2 の 5 項目がそろう", () => {
	const s = normalizeSettings({ vaultName: "V", urls: ["https://example.com/"] });
	assert.deepEqual(Object.keys(s).sort(), [...KEYS].sort());
	assert.equal("urls" in s, false);
	assert.equal(s.vaultName, "V");
	assert.equal(s.heading, DEFAULTS.heading);
});

test("§9.2: 足りない・型の違う項目は既定。空文字はそのまま。baseFolder の前後の / を取る", () => {
	assert.deepEqual(normalizeSettings(undefined), { ...DEFAULTS });
	assert.deepEqual(normalizeSettings("x"), { ...DEFAULTS });
	const s = normalizeSettings({ vaultName: "", heading: "", openAfterCreate: "no", baseFolder: "/a/b//", lastTopic: 3 });
	assert.deepEqual(s, { vaultName: "", baseFolder: "a/b", heading: "", openAfterCreate: true, lastTopic: "" });
});

test("loadSettings・saveSettings は storage.local の settings だけを読み書きし、整えた値を通す", async () => {
	const store = {};
	globalThis.chrome = {
		storage: {
			local: {
				get: async (key) => (key in store ? { [key]: store[key] } : {}),
				set: async (obj) => Object.assign(store, obj),
			},
		},
	};
	try {
		assert.deepEqual(await loadSettings(), { ...DEFAULTS });
		const saved = await saveSettings({ ...DEFAULTS, lastTopic: "話題", tabs: [1] });
		assert.deepEqual(Object.keys(store), ["settings"]);
		assert.deepEqual(store.settings, saved);
		assert.equal(saved.lastTopic, "話題");
		assert.equal("tabs" in store.settings, false);
		assert.deepEqual(await loadSettings(), saved);
	} finally {
		delete globalThis.chrome;
	}
});
