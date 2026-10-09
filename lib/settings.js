// 設定(chrome.storage.local のキー "settings" の 5 項目だけ。§9.2・INV-2)の既定・整え・読み書き。
// chrome は関数の中でだけ触る(Node のテストで import できるように)。
// DEFAULTS の vaultName・baseFolder・heading は §8.2 の仮決め(NOTES.md の仮決め一覧)。

export const DEFAULTS = Object.freeze({
	vaultName: "Claude",
	baseFolder: "レポート/調査レポート",
	heading: "## 出典",
	openAfterCreate: true,
	lastTopic: "",
});

// 型の合わない項目は既定で埋め、未知の項目は捨てる。baseFolder の前後の "/" を取る
export function normalizeSettings(obj) {
	const src = obj && typeof obj === "object" ? obj : {};
	const out = {};
	for (const [key, def] of Object.entries(DEFAULTS)) out[key] = typeof src[key] === typeof def ? src[key] : def;
	out.baseFolder = out.baseFolder.replace(/^\/+|\/+$/g, "");
	return out;
}

export async function loadSettings() {
	const r = await chrome.storage.local.get("settings");
	return normalizeSettings(r.settings);
}

// 書いた値を返す。失敗したら例外(保存値は前のまま)
export async function saveSettings(obj) {
	const settings = normalizeSettings(obj);
	await chrome.storage.local.set({ settings });
	return settings;
}
