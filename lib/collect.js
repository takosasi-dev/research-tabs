// タブの配列を「対象」と「除いた物(理由つき)」に分け、既定の選び方を決める純関数(FR-2・FR-3・FR-5・INV-10)。
// chrome の API に触らない。tabs は chrome.tabs.Tab から id・index・title・url・highlighted を写した物。
import { formatSourceLine } from "./sourcestamp/format.js";

// FR-2: 選んだタブが 2 つ以上なら "selected"、それ以外は "window"
export function chooseDefaultMode(tabs) {
	return tabs.filter((t) => t.highlighted).length >= 2 ? "selected" : "window";
}

// FR-5: 制御文字(改行・タブを含む)の続きを空白 1 つにし、前後の空白を取る。
// 「タイトル無し」の判定と画面の表示(label)だけに使い、出典行には手を加えない題を渡す(SourceStamp と同じ行にするため)
const cleanTitle = (s) => String(s ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim();

// FR-3 の (i)(ii)。当たらなければ null と、重複の判定に使う href
function excludeReason(url) {
	if (!url || url === "about:blank" || url.startsWith("chrome://newtab")) return { reason: "empty" };
	let u;
	try {
		u = new URL(url);
	} catch {
		return { reason: "scheme" };
	}
	if (u.protocol !== "http:" && u.protocol !== "https:") return { reason: "scheme" };
	return { reason: null, href: u.href };
}

// → { targets: [{ tabId, index, title, url, label, titleMissing }], excluded: [{ tabId, index, title, url, reason }] }
// title・url はタブのまま(出典行に渡す)。label は画面に出す題(整えた題、タイトル無しなら URL)。
// タブの並び(index)の順に判定し、最初に当たった理由で除く。重複は左に残した対象と href が同じ物。
export function classifyTabs(tabs) {
	const targets = [];
	const excluded = [];
	const seen = new Set();
	for (const t of [...tabs].sort((a, b) => a.index - b.index)) {
		const url = typeof t.url === "string" ? t.url : "";
		const base = { tabId: t.id, index: t.index, title: String(t.title ?? ""), url };
		let { reason, href } = excludeReason(url);
		if (!reason && seen.has(href)) reason = "duplicate";
		if (reason) {
			excluded.push({ ...base, reason });
			continue;
		}
		seen.add(href);
		const title = cleanTitle(t.title);
		// タイトルの無いページは、Chrome が URL を表示用に整えた物を題にする。出典行が代わりの題を使うかどうか(SourceStamp (b) 4)と同じにする
		const titleMissing = formatSourceLine({ title: base.title, url }, { bullet: false }).usedFallbackTitle;
		targets.push({ ...base, label: titleMissing ? url : title, titleMissing });
	}
	return { targets, excluded };
}
