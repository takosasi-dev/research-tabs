// ResearchTabs の設定ページの動き。設定の読み書き(FR-13・§9.2)と、
// 合成の N 行で Obsidian URI を組み、文字数を出してから開く診断(FR-15。§8.5 の記入だけに使う)。
import { loadSettings, saveSettings } from "./lib/settings.js";
import { formatSourceLine } from "./lib/format.js";
import { buildDocument } from "./lib/document.js";
import { buildNewNoteUri } from "./lib/obsidian-uri.js";

const $ = (id) => document.getElementById(id);

function say(id, text, isError = false) {
	$(id).textContent = text;
	$(id).className = isError ? "error" : "";
}

function fill(s) {
	$("vault-name").value = s.vaultName;
	$("base-folder").value = s.baseFolder;
	$("heading").value = s.heading;
	$("open-after-create").checked = s.openAfterCreate;
}

$("settings").addEventListener("submit", async (ev) => {
	ev.preventDefault();
	try {
		const saved = await saveSettings({
			...(await loadSettings()), // lastTopic は popup の値を残す
			vaultName: $("vault-name").value.trim(),
			baseFolder: $("base-folder").value.trim(),
			heading: $("heading").value,
			openAfterCreate: $("open-after-create").checked,
		});
		fill(saved);
		say("save-result", "保存しました");
	} catch (e) {
		say("save-result", `保存できませんでした(前の設定のまま): ${e.name}: ${e.message}`, true);
	}
});

const stamp = () => new Date().toTimeString().slice(0, 8).replaceAll(":", "");

$("diag").addEventListener("submit", async (ev) => {
	ev.preventDefault();
	$("diag-length").textContent = "";
	const n = Number($("diag-n").value);
	const mode = $("diag-mode").value;
	if (!Number.isInteger(n) || n < 1) {
		say("diag-result", "行数 N は 1 以上の整数にしてください", true);
		return;
	}
	const lines = Array.from({ length: n }, (_, i) => formatSourceLine({ title: `試験 ${i + 1}`, url: `https://example.com/${i + 1}` }));
	const content = buildDocument({ heading: "", lines });
	let uri;
	try {
		uri = buildNewNoteUri({ vaultName: $("diag-vault").value.trim(), fileName: `ResearchTabs診断_${mode}_${n}_${stamp()}`, mode, content });
	} catch (e) {
		say("diag-result", `開きません: ${e.message}`, true);
		return;
	}
	$("diag-length").textContent = `URI の文字数: ${uri.length}`;
	if (mode === "clipboard") {
		try {
			await navigator.clipboard.writeText(content);
		} catch (e) {
			say("diag-result", `クリップボードに書けないので開きません: ${e.name}: ${e.message}`, true);
			return;
		}
	}
	say("diag-result", `開きました(${n} 行)。Obsidian でノートの行数と、Chrome の確認の文言を見てください`);
	location.href = uri; // 診断の開き方はこのページ自身の移動(仮決め。NOTES.md)
});

loadSettings()
	.then(fill)
	.catch((e) => say("save-result", `設定を読めませんでした: ${e.name}: ${e.message}`, true));
