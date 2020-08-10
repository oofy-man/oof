#!/usr/bin/env node
require('console.table')
require('colors')
const program = require('commander')
const packageJSON = require('../package.json')
const fetch = require('node-fetch')
const iconv = require('iconv-lite')
const inquirer = require('inquirer')
const { write, read } = require('./fs')
const fs = require('fs')
const path = require('path')

const USER_HOME = process.env.HOME || process.env.USERPROFILE
const CONFIG_DIR = path.resolve(USER_HOME, './.oof')
const CONFIG_FILEPATH = path.resolve(CONFIG_DIR, './config')
const EMUM_EXCHANGE = Object.freeze({ SH: 0, SZ: 1 })
const CODE_MATCHER = Object.freeze({
  [EMUM_EXCHANGE.SH]: /^60\d{4}$/,
  [EMUM_EXCHANGE.SZ]: /^(300|002|000)\d{3}$/,
})
const MAP_POSITION = Object.freeze({
  0: '股票名字',
  1: '今日开盘价',
  2: '昨日收盘价',
  3: '当前价格',
  4: '今日最高价',
  5: '今日最低价',
  6: '买一',
  7: '卖一',
  8: '成交的股票数(股)',
  9: '成交金额(元)',
})

program.version(packageJSON.version)
program
  .command('show [codes...]')
  .description('根据code查询详情')
  .action(async codes => {
    let config = await getConfig()
    if (!codes.length) {
      while (true) {
        await fetchDetailByCodes(config.cart)
        await sleep(2000)
      }
    } else {
      inquirer
        .prompt([
          {
            type: 'confirm',
            name: 'isAddToCart',
            message: `是否将${codes.map(it => it.green)}加入收藏?`,
          },
        ])
        .then(async answers => {
          if (answers.isAddToCart) {
            try {
              if (!config.cart) {
                config.cart = []
              }
              config.cart = [...new Set([...config.cart, ...codes])]
              write(config, CONFIG_FILEPATH)
            } catch (error) {}
          }
          while (true) {
            await fetchDetailByCodes(codes)
            await sleep(2000)
          }
        })
    }
  })

program
  .command('cart')
  .description('codes cart')
  .option('-a, --add <codes...>', 'add cart codes')
  .option('-d, --delete <codes...>', 'delete cart codes')
  .option('-l, --list', 'list cart codes')
  .action(async options => {
    try {
      const config = await getConfig()
      if (options.add) {
        if (!validateCodes(options.add)) throw Error('Please check your code')
        const addCodes = options.add
        config.cart = [...new Set([...config.cart, ...addCodes])]
      } else if (options.list) {
        console.log(`cart codes: ${config.cart.toString().green}`.grey)
      } else if (options.delete) {
        if (!validateCodes(options.delete))
          throw Error('Please check your code')
        const deleteCodes = options.delete
        config.cart = config.cart.filter(c => !deleteCodes.includes(c))
        write(config, CONFIG_FILEPATH)
      } else {
        console.log(`cart codes: ${config.cart.toString().green}`.grey)
      }
    } catch (e) {
      console.error(e.message.red)
    }
  })

program.parse(process.argv)

async function fetchDetailByCodes(codes) {
  const table = []
  codes = codes
    .map(code => {
      const prefix = validateCode(code)
      if (!prefix) throw Error('请检查code')
      return `${prefix}${code}`
    })
    .filter(Boolean)

  const api = `https://hq.sinajs.cn/list=${codes.join(',')}`
  const response = await fetch(api)
  const buffer = await response.buffer()
  const source = iconv.decode(buffer, 'GB18030')
  const sources = source.split(';\n').filter(Boolean)

  sources.forEach(source => {
    source.match(/"(.*)"/)
    const attrArray = RegExp.$1.split(',')

    let row = {}
    for (const key in MAP_POSITION) {
      if (MAP_POSITION.hasOwnProperty(key)) {
        const element = MAP_POSITION[key]
        row[element] = ['2', '3'].includes(key)
          ? attrArray[key].green
          : attrArray[key]
      }
    }

    const rate = (((attrArray[3] - attrArray[2]) / attrArray[2]) * 100).toFixed(
      2,
    )
    row['涨幅'] = rate >= 0 ? `${rate}%`.red : `${rate}%`.green
    table.push(row)
  })

  process.stdout.write(
    process.platform === 'win32' ? '\x1B[2J\x1B[0f' : '\x1B[2J\x1B[3J\x1B[H',
  )
  console.log('*********************************************'.grey)
  console.log('更新时间:', new Date().toLocaleString().green)
  console.log('*********************************************'.grey)
  console.log('\n')
  console.table(table)
}

function sleep(time) {
  return new Promise(resolve => setTimeout(resolve, time))
}

async function getConfig() {
  let config = { cart: [] }
  try {
    if (fs.existsSync(CONFIG_FILEPATH)) {
      config = await read(CONFIG_FILEPATH)
    }
    if (!fs.existsSync(USER_HOME)) {
      return process.exit(-1)
    }
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR)
    }
    if (!fs.existsSync(CONFIG_FILEPATH)) {
      fs.writeFileSync(CONFIG_FILEPATH, JSON.stringify(config))
    }
  } catch (e) {
    console.error(e)
  }
  return config
}

function validateCode(code) {
  let prefix
  if (CODE_MATCHER[EMUM_EXCHANGE.SZ].test(code)) {
    prefix = 'sz'
  } else if (CODE_MATCHER[EMUM_EXCHANGE.SH].test(code)) {
    prefix = 'sh'
  }

  if (!prefix) {
    return null
  }

  return prefix
}

function validateCodes(codes) {
  return codes.every(validateCode)
}
