#!/usr/bin/env node
require("console.table");
const program = require("commander");
const packageJSON = require("../package.json");
const fetch = require("node-fetch");
const iconv = require("iconv-lite");

const EMUM_EXCHANGE = Object.freeze({ SH: 0, SZ: 1 });
const CODE_MATCHER = Object.freeze({
  [EMUM_EXCHANGE.SH]: /^60\d{4}$/,
  [EMUM_EXCHANGE.SZ]: /^(300|002|000)\d{3}$/,
});
const MAP_POSITION = Object.freeze({
  0: "股票名字",
  1: "今日开盘价",
  2: "昨日收盘价",
  3: "当前价格",
  4: "今日最高价",
  5: "今日最低价",
  6: "买一",
  7: "卖一",
  8: "成交的股票数(股)",
  9: "成交金额(元)",
});

program.version(packageJSON.version);
program
  .command("show <codes...>")
  .description("根据code查询详情")
  .action(async (codes) => {
    while (true) {
      await fetchDetailByCodes(codes);
      await sleep(5000);
    }
  });
program.parse(process.argv);

async function fetchDetailByCodes(codes) {
  const table = [];
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    let prefix;
    if (CODE_MATCHER[EMUM_EXCHANGE.SZ].test(code)) {
      prefix = "sz";
    } else if (CODE_MATCHER[EMUM_EXCHANGE.SH].test(code)) {
      prefix = "sh";
    }

    if (!prefix) {
      return console.log("code无效");
    }

    const api = `http://hq.sinajs.cn/list=${prefix}${code}`;
    const response = await fetch(api);
    const buffer = await response.buffer();
    const source = iconv.decode(buffer, "GB18030");
    source.match(/"(.*)"/);
    const attrArray = RegExp.$1.split(",");

    let row = {};
    for (const key in MAP_POSITION) {
      if (MAP_POSITION.hasOwnProperty(key)) {
        const element = MAP_POSITION[key];
        row[element] = toNumber(attrArray[key]);
      }
    }
    table.push(row);
  }
  process.stdout.write(
    process.platform === "win32" ? "\x1B[2J\x1B[0f" : "\x1B[2J\x1B[3J\x1B[H"
  );
  console.log("*********************************************");
  console.log("更新时间:", new Date().toLocaleString());
  console.log("*********************************************");
  console.log("\n");
  console.table(table);
}

function toNumber(unknow) {
  if (typeof unknow === "number") return unknow;
  if (typeof unknow === "string") return isNaN(+unknow) ? unknow : +unknow;
  return "";
}

function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}