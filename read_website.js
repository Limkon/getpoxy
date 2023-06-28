const fs = require('fs');
const path = require('path');
const moment = require('moment');
const puppeteer = require('puppeteer-core');
const yaml = require('js-yaml');
const { Worker, isMainThread } = require('worker_threads');

const NUM_THREADS = 10; // 定义线程池中的线程数量

if (isMainThread) {
  mainThread();
} else {
  workerThread();
}

async function mainThread() {
  try {
    const browser = await puppeteer.launch({
      executablePath: 'google-chrome-stable',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    page.setDefaultTimeout(5000);

    const urls = fs
      .readFileSync('urls', 'utf-8')
      .split('\n')
      .map(url => url.trim())
      .filter(url => url !== '');

    const threadPool = new Set();
    const preservedFiles = [];
    const preservedUrls = [];

    for (let i = 0; i < NUM_THREADS; i++) {
      const worker = new Worker(__filename);
      threadPool.add(worker);
    }

    for (const worker of threadPool) {
      worker.on('message', result => {
        if (result.preserve) {
          preservedFiles.push(result.fileName);
          preservedUrls.push(result.url);
        }

        if (result.error) {
          console.error(`处理 ${result.url} 失败：${result.error}`);
        } else {
          console.log(`网站 ${result.url} 内容已保存至文件：${result.fileName}`);
        }
      });

      worker.on('error', error => {
        console.error(`线程处理失败：${error}`);
      });

      worker.on('exit', () => {
        threadPool.delete(worker);
        if (threadPool.size === 0) {
          fs.writeFileSync('urls', preservedUrls.join('\n'));
          console.log('更新后的 URL 列表已保存到文件！');
          console.log('所有网站内容保存完成！');
          browser.close();
        }
      });

      const urlsToProcess = urls.splice(0, Math.ceil(urls.length / (NUM_THREADS - threadPool.size)));
      worker.postMessage(urlsToProcess);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

async function workerThread() {
  try {
    const browser = await puppeteer.launch({
      executablePath: 'google-chrome-stable',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    page.setDefaultTimeout(5000);

    process.on('message', async urls => {
      for (const url of urls) {
        try {
          await page.goto(url);

          const selectors = [
            '#app',
          ];

          let content = '';
          let success = false;

          for (const selector of selectors) {
            try {
              await page.waitForSelector(selector);
              const element = await page.$(selector);
              content = await page.evaluate(element => element.innerText, element);
              success = true;
              break;
            } catch (error) {
              console.error(`尝试通过选择器 ${selector} 获取 ${url} 内容失败：${error.message}`);
            }
          }

          if (!success) {
            console.error(`所有选择器都无法获取 ${url} 的内容，将执行自定义代码`);
            const customContent = await page.evaluate(() => {
              // 自定义的 JavaScript 代码
              return document.documentElement.innerText;
            });

            if (customContent) {
              content = customContent;
              console.log(`通过自定义代码成功提取了 ${url} 的内容`);
            } else {
              console.error(`自定义代码也无法获取 ${url} 的内容`);
              process.send({ url, error: '获取内容失败' });
              continue;
            }
          }

          if (!isBase64(content) && !isSpecialFormat(content)) {
            let isJsonFile = false;
            try {
              const jsonContent = JSON.parse(content);
              if (jsonContent && typeof jsonContent === 'object') {
                isJsonFile = true;
                const date = moment().format('YYYY-MM-DD');
                const urlWithoutProtocol = url.replace(/^(https?:\/\/)/, '');
                const fileName = path.join('json_files', `${urlWithoutProtocol.replace(/[:?<>|"*\r\n/]/g, '_')}_${date}.json`);
                fs.writeFileSync(fileName, content);
                console.log(`网站 ${url} 内容是 JSON 文件，已保存至文件：${fileName}`);
                process.send({ url, fileName, preserve: true });
              }
            } catch (error) {
              // 不是有效的 JSON 文件
            }

            let isYamlFile = false;
            try {
              const yamlContent = yaml.safeLoad(content);
              if (yamlContent && typeof yamlContent === 'object') {
                isYamlFile = true;
                const date = moment().format('YYYY-MM-DD');
                const urlWithoutProtocol = url.replace(/^(https?:\/\/)/, '');
                const fileName = path.join('yaml_files', `${urlWithoutProtocol.replace(/[:?<>|"*\r\n/]/g, '_')}_${date}.yaml`);
                fs.writeFileSync(fileName, content);
                console.log(`网站 ${url} 内容是 YAML 文件，已保存至文件：${fileName}`);
                process.send({ url, fileName, preserve: true });
              }
            } catch (error) {
              // 不是有效的 YAML 文件
            }

            if (!isJsonFile && !isYamlFile) {
              console.error(`获取的 ${url} 内容既不是 BASE64 编码也不符合特定格式，将从 URL 列表中删除`);
              process.send({ url, error: '内容格式不符合要求' });
              continue;
            }
          }

          const date = moment().format('YYYY-MM-DD');
          const urlWithoutProtocol = url.replace(/^(https?:\/\/)/, '');
          const fileName = path.join('data', `${urlWithoutProtocol.replace(/[:?<>|"*\r\n/]/g, '_')}_${date}.txt`);
          fs.writeFileSync(fileName, content);
          process.send({ url, fileName });
        } catch (error) {
          console.error(`处理 ${url} 失败：${error.message}`);
          process.send({ url, error: error.message });
        }
      }
      process.exit(0);
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

function isBase64(str) {
  const base64Regex = /^(data:.*?;base64,)?([A-Za-z0-9+/=])+$/;
  return base64Regex.test(str);
}

function isSpecialFormat(str) {
  const specialFormatRegex = /vmess:\/\/|trojan:\/\/|clash:\/\/|ss:\/\/|vlss:\/\//;
  return specialFormatRegex.test(str);
}
