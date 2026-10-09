// ResearchTabs の popup の動き。タブの URL とタイトルを読み(FR-1・FR-2)、分けて並べてプレビューを作り(FR-4〜FR-9・FR-14)、
// コピー(FR-10)と Obsidian の新しいノート(FR-11・FR-12)を行う。タブは読むだけで変えず、保存しない(INV-1・INV-2・INV-4)。
import { chooseDefaultMode, classifyTabs } from "./lib/collect.js";
import { formatSourceLine } from "./lib/format.js";
import { buildDocument } from "./lib/document.js";
import { buildNewNoteUri, validateNamePart } from "./lib/obsidian-uri.js";
import { loadSettings, saveSettings } from "./lib/settings.js";

const $ = (id) => document.getElementById(id);
const REASONS = { empty: "空のタブ", scheme: "http/https 以外", duplicate: "重複" };
const NO_GROUP = -1; // tabGroups.TAB_GROUP_ID_NONE(tabGroups の権限を持たないので値で書く)

function el(tag, text, className) {
	const e = document.createElement(tag);
	if (text !== undefined) e.textContent = text;
	if (className) e.className = className;
	return e;
}

function today() {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// §2 の項目のうち collect に渡す物だけを写す
const pick = (t) => ({ id: t.id, index: t.index, title: t.title, url: t.url, highlighted: t.highlighted });

const date = today();
let settings;
let activeTabId;
let sets; // { window, selected, group }(group は今のタブがグループに無ければ null)
let classified = { targets: [], excluded: [] };
const unchecked = new Set(); // 一覧でチェックを外した tabId
let doc = "";
let outCount = 0;
let fileNameEdited = false;

function showResult(text, isError = false) {
	$("result").textContent = text;
	$("result").className = isError ? "error" : "";
}

function setMode(mode) {
	classified = classifyTabs(sets[mode]);
	unchecked.clear();
	renderTargets();
	renderExcluded();
	renderOutput();
}

function renderTargets() {
	$("targets").replaceChildren(
		...classified.targets.map((t) => {
			const box = el("input");
			box.type = "checkbox";
			box.checked = true;
			box.addEventListener("change", () => {
				if (box.checked) unchecked.delete(t.tabId);
				else unchecked.add(t.tabId);
				renderOutput();
			});
			const label = el("label");
			label.title = t.url;
			label.append(box, el("span", t.label, "title"), el("span", new URL(t.url).hostname, "host"));
			const li = el("li");
			li.append(label);
			return li;
		}),
	);
}

// FR-4: 理由ごとの件数を 1 行で。開くと理由ごとにタイトルと URL。0 件の理由は出さない
function renderExcluded() {
	const { excluded } = classified;
	$("excluded").hidden = excluded.length === 0;
	const parts = [];
	const blocks = [];
	for (const [reason, name] of Object.entries(REASONS)) {
		const items = excluded.filter((x) => x.reason === reason);
		if (items.length === 0) continue;
		parts.push(`${name} ${items.length}`);
		const ul = el("ul");
		ul.append(...items.map((x) => el("li", `${x.title || "(タイトル無し)"} — ${x.url || "(URL 無し)"}`)));
		blocks.push(el("p", `${name} ${items.length}`), ul);
	}
	$("excluded-summary").textContent = `除いた物 ${excluded.length}: ${parts.join("・")}`;
	$("excluded-list").replaceChildren(...blocks);
}

function renderOutput() {
	const chosen = classified.targets.filter((t) => !unchecked.has(t.tabId));
	$("empty").hidden = classified.targets.length > 0;
	$("unchecked").textContent = unchecked.size ? `外した物 ${unchecked.size}` : "";
	const missing = chosen.filter((t) => t.titleMissing).length;
	$("warning").textContent = missing ? `タイトル無し ${missing} 件` : "";
	showResult("");

	// FR-16: 出典行を作れないタブがあれば出力を作らず、どのタブかを出す
	const lines = [];
	for (const t of chosen) {
		try {
			lines.push(formatSourceLine({ title: t.title, url: t.url, date }));
		} catch (e) {
			lines.length = 0;
			showResult(`出典行を作れませんでした: ${t.label}(${t.url}) ${e.name}: ${e.message}`, true);
			break;
		}
	}
	outCount = lines.length;
	doc = outCount ? buildDocument({ heading: settings.heading, lines }) : "";
	$("preview").textContent = doc;
	updateButtons();
}

function showNameError(id, value) {
	const v = validateNamePart(value);
	$(id).textContent = v.ok ? "" : v.badChars.length ? `使えない: ${v.badChars.map((c) => `「${c}」`).join(" ")}` : "入れてください";
	return v.ok;
}

function updateButtons() {
	const topicOk = showNameError("topic-error", $("topic").value);
	const fileOk = showNameError("file-name-error", $("file-name").value);
	const configured = Boolean(settings.vaultName && settings.baseFolder);
	$("copy").disabled = outCount === 0;
	$("obsidian").disabled = outCount === 0 || !configured || !topicOk || !fileOk;
	$("open-options").hidden = configured;
}

const defaultFileName = () => `${date}_${$("topic").value}_出典`;

async function copy() {
	try {
		await navigator.clipboard.writeText(doc);
		showResult(`${outCount} 件をコピーしました`);
	} catch (e) {
		showResult(`コピーできませんでした: ${e.name}: ${e.message}`, true);
	}
}

// §9.5 の順番: (1) クリップボードに全文 (2) 書けたら URI を開く (3) 書けなければ開かない
async function sendToObsidian() {
	const topic = $("topic").value;
	let uri;
	try {
		uri = buildNewNoteUri({
			vaultName: settings.vaultName,
			baseFolder: settings.baseFolder,
			topic,
			fileName: $("file-name").value,
			silent: !settings.openAfterCreate,
		});
	} catch (e) {
		showResult(`送れませんでした: ${e.message}`, true);
		return;
	}
	try {
		await navigator.clipboard.writeText(doc);
	} catch (e) {
		showResult(`クリップボードに書けないので送りませんでした: ${e.name}: ${e.message}`, true);
		return;
	}
	let note = "";
	try {
		settings = await saveSettings({ ...(await loadSettings()), lastTopic: topic });
	} catch (e) {
		note = `(話題を覚えられませんでした: ${e.message})`;
	}
	try {
		// §8.5 OPEN_METHOD の仮決め (a): 今のタブに obsidian:// を渡す(INV-4 の 1 か所。NOTES.md)
		await chrome.tabs.update(activeTabId, { url: uri });
		showResult(`Obsidian に送りました。ノートができたかは Obsidian で確かめてください${note}`);
	} catch (e) {
		showResult(`Obsidian を開けませんでした: ${e.name}: ${e.message}${note}`, true);
	}
}

async function main() {
	settings = await loadSettings();
	// FR-1
	const windowTabs = await chrome.tabs.query({ currentWindow: true });
	const active = windowTabs.find((t) => t.active);
	activeTabId = active?.id;
	const [selected, group] = await Promise.all([
		chrome.tabs.query({ currentWindow: true, highlighted: true }),
		active && active.groupId !== NO_GROUP ? chrome.tabs.query({ groupId: active.groupId }) : null,
	]);
	sets = { window: windowTabs.map(pick), selected: selected.map(pick), group: group ? group.map(pick) : null };

	$("count-window").textContent = String(sets.window.length);
	$("count-selected").textContent = String(sets.selected.length);
	if (sets.group) $("count-group").textContent = String(sets.group.length);
	const radios = document.querySelectorAll('input[name="mode"]');
	for (const r of radios) {
		if (r.value === "selected" && sets.selected.length < 2) {
			r.disabled = true;
			$("why-selected").textContent = "Ctrl+クリックで2つ以上選ぶと使える";
		}
		if (r.value === "group" && !sets.group) {
			r.disabled = true;
			$("why-group").textContent = "今のタブはグループに入っていない";
		}
		r.addEventListener("change", () => r.checked && setMode(r.value));
	}
	// FR-2: 開くたびに決める(前回の選択は覚えない)
	const mode = chooseDefaultMode(sets.window);
	document.querySelector(`input[name="mode"][value="${mode}"]`).checked = true;

	$("topic").value = settings.lastTopic;
	$("file-name").value = defaultFileName();
	$("topic").addEventListener("input", () => {
		if (!fileNameEdited) $("file-name").value = defaultFileName();
		updateButtons();
	});
	$("file-name").addEventListener("input", () => {
		fileNameEdited = true;
		updateButtons();
	});
	$("copy").addEventListener("click", copy);
	$("obsidian").addEventListener("click", sendToObsidian);
	$("open-options").addEventListener("click", () => chrome.runtime.openOptionsPage());

	setMode(mode);
}

main().catch((e) => showResult(`タブを読めませんでした: ${e.name}: ${e.message}`, true));
