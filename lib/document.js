// 見出しと出典行から Markdown の全文を作る純関数(FR-8)。
// 見出しが空なら出典行から始め、どちらも末尾は改行 1 つ。

export function buildDocument({ heading, lines }) {
	return (heading ? heading + "\n\n" : "") + lines.join("\n") + "\n";
}
