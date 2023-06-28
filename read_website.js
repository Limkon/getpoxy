const { Worker, isMainThread, parentPort } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const puppeteer = require('puppeteer-core');
const yaml = require('js-yaml');

if (isMainThread) {
  const numThreads = 5; // 设置工作线程数量
  const chunkSize = Math.ceil(urls.length / numThreads);

  // 创建工作线程
  const workers = [];
  const preservedFiles = [];
  const preservedUrls = [];

  for (let i = 0; i < numThreads; i++) {
    const start = i * chunkSize;
    const end = start + chunkSize;
    const workerUrls = urls.slice(start, end);

    const worker = new Worker(__filename);
    worker.postMessage({ urls: workerUrls });
    workers.push(worker);

    worker.on('message', ({ preservedFiles: workerFiles, preservedUrls: workerUrls }) => {
      preservedFiles.push(...workerFiles);
      preservedUrls.push(...workerUrls);
    });
  }

  // 等待所有工作线程完成
  Promise.all(workers.map(worker => new Promise(resolve => worker.on('exit', resolve))))
    .then(() => {
      // 更新 URL 列表文件，将保留的 URL 写回文件
      fs.writeFileSync('urls', preservedUrls.join('\n'));
      console.log('更新后的 URL 列表已保存到文件！');

      console.log('所有网站内容保存完成！');
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
} else {
  parentPort.on('message', async ({ urls }) => {
    const browser = await puppeteer.launch({
      executablePath: 'google-chrome-stable',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    // 将页面等待时间更改为 5000 毫秒
    page.setDefaultTimeout(5000);

    const preservedFiles = []; // 用于存储保留的文件
    const preservedUrls = []; // 用于存储保留的 URL

    for (const url of urls) {
      try {
        await page.goto(url);

        // 尝试不同的选择器
        const selectors = [
          '#app',                 // ID 选择器
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
              const fileName = path.join('json_files', `${urlWithoutProtocol.replace(/[:?<>|"*\r\n/]/g, '_')}_${date}.json`);
              fs.writeFileSync(fileName, content);
              console.log(`网站 ${url} 内容是 JSON 文件，已保存至文件：${fileName}`);

              // 保留文件和 URL
              preservedFiles.push(fileName);
              preservedUrls.push(url);
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
              const fileName = path.join('yaml_files', `${urlWithoutProtocol.replace(/[:?<>|"*\r\n/]/g, '_')}_${date}.yaml`);
              fs.writeFileSync(fileName, content);
              console.log(`网站 ${url} 内容是 YAML 文件，已保存至文件：${fileName}`);

              // 保留文件和 URL
              preservedFiles.push(fileName);
              preservedUrls.push(url);
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

        const date = moment().format('YYYY-MM-DD');
        const urlWithoutProtocol = url.replace(/^(https?:\/\/)/, '');
        const fileName = path.join('data', `${urlWithoutProtocol.replace(/[:?<>|"*\r\n/]/g, '_')}_${date}.txt`);

        fs.writeFileSync(fileName, content);

        preservedFiles.push(fileName);
        preservedUrls.push(url);
        console.log(`网站 ${url} 内容已保存至文件：${fileName}`);
      } catch (error) {
        console.error(`处理 ${url} 失败：${error.message}`);
      }
    }

    // 将保留的文件和 URL 返回给主线程
    parentPort.postMessage({ preservedFiles, preservedUrls });

    await browser.close();
  });
}

function isBase64(str) {
  const base64Regex = /^(data:.*?;base64,)?([A-Za-z0-9+/=])+$/;
  return base64Regex.test(str);
}

function isSpecialFormat(str) {
  const specialFormatRegex = /vmess:\/\/|trojan:\/\/|clash:\/\/|ss:\/\/|vlss:\/\//;
  return specialFormatRegex.test(str);
}
