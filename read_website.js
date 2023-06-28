const fs = require('fs');
const path = require('path');
const moment = require('moment');
const puppeteer = require('puppeteer-core');
const yaml = require('js-yaml');
const { Worker } = require('worker_threads');

const MAX_WORKERS = 10; // 最大工作线程数
const BATCH_SIZE = 10; // 每批处理的URL数量

(async () => {
  try {
    const browser = await puppeteer.launch({
      executablePath: 'google-chrome-stable',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    // 将页面等待时间更改为 5000 毫秒
    page.setDefaultTimeout(5000);

    // 读取文件内容，获取所有要抓取的 URL 列表
    const urls = fs
      .readFileSync('urls', 'utf-8')
      .split('\n')
      .map(url => url.trim())
      .filter(url => url !== '');

    const preservedFiles = []; // 用于存储保留的文件
    const preservedUrls = []; // 用于存储保留的 URL

    // 将URL分割成批次
    const batches = [];
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      batches.push(urls.slice(i, i + BATCH_SIZE));
    }

    // 启动工作线程池
    const workers = [];
    for (let i = 0; i < Math.min(MAX_WORKERS, batches.length); i++) {
      const worker = new Worker(process.argv[1]);
      workers.push(worker);

      // 处理工作线程的消息
      worker.on('message', ({ url, fileName, preserve, error }) => {
        if (fileName) {
          preservedFiles.push(fileName);
          preservedUrls.push(url);
        }

        if (preserve) {
          preservedUrls.push(url);
        }

        if (error) {
          console.error(`处理 ${url} 失败：${error}`);
        } else {
          console.log(`网站 ${url} 内容已保存至文件：${fileName}`);
        }
      });

      // 处理工作线程的错误
      worker.on('error', error => {
        console.error(`工作线程发生错误：${error}`);
      });

      // 处理工作线程的退出
      worker.on('exit', code => {
        if (code !== 0) {
          console.error(`工作线程退出，退出码：${code}`);
        }

        // 检查是否还有未完成的任务
        if (workers.every(worker => worker.exitedAfterDisconnect)) {
          // 更新 URL 列表文件，将保留的 URL 写回文件
          fs.writeFileSync('urls', preservedUrls.join('\n'));
          console.log('更新后的 URL 列表已保存到文件！');

          // 关闭浏览器
          browser.close().then(() => {
            console.log('所有网站内容保存完成！');
          });
        }
      });
    }

    // 分配任务给工作线程
    let batchIndex = 0;
    for (const worker of workers) {
      if (batchIndex < batches.length) {
        const batchUrls = batches[batchIndex];
        batchIndex++;

        worker.postMessage({ batchUrls });
      } else {
        worker.terminate();
      }
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();

// 工作线程处理函数
function workerThread() {
  const fs = require('fs');
  const path = require('path');
  const moment = require('moment');
  const puppeteer = require('puppeteer-core');
  const yaml = require('js-yaml');

  async function processBatchUrls(batchUrls) {
    const browser = await puppeteer.launch({
      executablePath: 'google-chrome-stable',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    // 将页面等待时间更改为 5000 毫秒
    page.setDefaultTimeout(5000);

    for (const url of batchUrls) {
      try {
        await page.goto(url);

        // 尝试不同的选择器
        const selectors = [
          '#app', // ID 选择器
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

        // 如果所有选择器都失败，则执行自定义 JavaScript 代码提取页面内容
        if (!success) {
          console.error(`所有选择器都无法获取 ${url} 的内容，将执行自定义代码`);

          const customContent = await page.evaluate(() => {
            // 在此编写自定义的 JavaScript 代码来选择和提取页面内容
            // 例如：返回整个页面的 innerText
            return document.documentElement.innerText;
          });

          if (customContent) {
            content = customContent;
            console.log(`通过自定义代码成功提取了 ${url} 的内容`);
          } else {
            console.error(`自定义代码也无法获取 ${url} 的内容`);
            continue;
          }
        }

        // 处理内容，保存到文件或保留 URL
        let fileName = '';
        let preserve = false;

        // 检测内容是否为 BASE64 编码或特定格式
        if (!isBase64(content) && !isSpecialFormat(content)) {
          // 检测是否为 JSON 文件
          let isJsonFile = false;
          try {
            const jsonContent = JSON.parse(content);
            if (jsonContent && typeof jsonContent === 'object') {
              isJsonFile = true;
              // 在此处理 JSON 文件，例如保存到指定目录
              const date = moment().format('YYYY-MM-DD');
              const urlWithoutProtocol = url.replace(/^(https?:\/\/)/, '');
              fileName = path.join('json_files', `${urlWithoutProtocol.replace(/[:?<>|"*\r\n/]/g, '_')}_${date}.json`);
              fs.writeFileSync(fileName, content);
              console.log(`网站 ${url} 内容是 JSON 文件，已保存至文件：${fileName}`);

              // 保留文件和 URL
              preserve = true;
            }
          } catch (error) {
            // 不是有效的 JSON 文件
          }

          // 检测是否为 YAML 文件
          let isYamlFile = false;
          try {
            const yamlContent = yaml.safeLoad(content);
            if (yamlContent && typeof yamlContent === 'object') {
              isYamlFile = true;
              // 在此处理 YAML 文件，例如保存到指定目录
              const date = moment().format('YYYY-MM-DD');
              const urlWithoutProtocol = url.replace(/^(https?:\/\/)/, '');
              fileName = path.join('yaml_files', `${urlWithoutProtocol.replace(/[:?<>|"*\r\n/]/g, '_')}_${date}.yaml`);
              fs.writeFileSync(fileName, content);
              console.log(`网站 ${url} 内容是 YAML 文件，已保存至文件：${fileName}`);

              // 保留文件和 URL
              preserve = true;
            }
          } catch (error) {
            // 不是有效的 YAML 文件
          }

          // 如果内容不是 BASE64 编码、特定格式、JSON 文件或 YAML 文件，则跳过处理
          if (!isJsonFile && !isYamlFile) {
            console.error(`获取的 ${url} 内容既不是 BASE64 编码也不符合特定格式，将从 URL 列表中删除`);
            continue;
          }
        }

        if (!fileName) {
          const date = moment().format('YYYY-MM-DD');
          const urlWithoutProtocol = url.replace(/^(https?:\/\/)/, '');
          fileName = path.join('data', `${urlWithoutProtocol.replace(/[:?<>|"*\r\n/]/g, '_')}_${date}.txt`);
          fs.writeFileSync(fileName, content);
        }

        process.send({ url, fileName, preserve });
      } catch (error) {
        process.send({ url, error: error.message });
      }
    }

    await browser.close();
  }

  process.on('message', ({ batchUrls }) => {
    processBatchUrls(batchUrls).then(() => {
      process.exit(0);
    });
  });
}

// 判断是否为 BASE64 编码
function isBase64(str) {
  const base64Regex = /^(data:.*?;base64,)?([A-Za-z0-9+/=])+$/;
  return base64Regex.test(str);
}

// 判断是否为特定格式
function isSpecialFormat(str) {
  const specialFormatRegex = /vmess:\/\/|trojan:\/\/|clash:\/\/|ss:\/\/|vlss:\/\//;
  return specialFormatRegex.test(str);
}
