// `node --test test/` の入口。Node 24 はフォルダの引数をテストのファイルに広げず、フォルダを 1 つのモジュール(test/index.js)として動かすため、ここで全部を読み込む。
// 引数なしの `node --test` だと test/ の .js が全部動き、このファイル経由と合わせて同じテストが 2 回ずつ動く(件数が倍に出る)。
import "./collect.test.js";
import "./format.test.js";
import "./document.test.js";
import "./obsidian-uri.test.js";
import "./settings.test.js";
import "./static.test.js";
