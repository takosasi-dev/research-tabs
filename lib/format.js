// 出典行を 1 行作る窓口(FR-7・FR-16・INV-6)。中身は SourceStamp の書式 v1 の写し(lib/sourcestamp/format.js。改変しない)を呼ぶだけ(D-2)。
// 設定は SourceStamp の既定(bullet true・includeDate false・stripParams utm_*)。行を作れなければ例外を投げる(popup がどのタブかを出す)。
import { formatSourceLine as stamp } from "./sourcestamp/format.js";

export function formatSourceLine({ title, url, date }) {
	const r = stamp({ title, url, date });
	if (!r.ok) throw new Error(`SourceStamp の書式で行を作れない(${r.error})`);
	return r.line;
}
