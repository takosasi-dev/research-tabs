// Obsidian URI `new` を組む・話題とファイル名を検査する純関数(§9.5・FR-12・INV-8)。
// `file` に `.md` は付けない(§8.5 NEW_MD_EXT の仮決め。NOTES.md)。overwrite・append・path は付けない。

const enc = encodeURIComponent;

// mode: "clipboard"(既定。FR-11)| "content"(FR-15 の診断だけ)
export function buildNewNoteUri({ vaultName, baseFolder, topic, fileName, mode = "clipboard", content = "", silent = false }) {
	if (!vaultName) throw new Error("vault 名が空です");
	const file = [baseFolder, topic, fileName].filter(Boolean).join("/");
	let uri = `obsidian://new?vault=${enc(vaultName)}&file=${enc(file)}`;
	uri += mode === "content" ? `&content=${enc(content)}` : "&clipboard";
	return silent ? uri + "&silent" : uri;
}

const BAD_CHARS = '\\/:*?"<>|#^[]';

// → { ok: true } | { ok: false, badChars }。badChars は駄目な文字と「前後の空白」「末尾の .」。空は badChars が []
export function validateNamePart(text) {
	const s = String(text ?? "");
	const badChars = [...new Set([...s].filter((c) => BAD_CHARS.includes(c)))];
	if (s !== s.trim()) badChars.push("前後の空白");
	if (s.endsWith(".")) badChars.push("末尾の .");
	return s !== "" && badChars.length === 0 ? { ok: true } : { ok: false, badChars };
}
