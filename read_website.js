const fs = require('fs');
const path = require('path');
const moment = require('moment');
const puppeteer = require('puppeteer-core');
const yaml = require('js-yaml');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const NUM_WORKERS = 4; // 指定工作线程的数量

// 主线程逻辑
if (isMainThread) {
  (async () => {
    try {
      const urls = fs
        .readFileSync('urls', 'utf-8')
        .split('\n')
        .map(url => url.trim())
        .filter(url => url !== '');

      const numUrls = urls.length;
      const chunkSize = Math.ceil(numUrls / NUM_WORKERS);

      // 将 URL 列表分成多个块，每个块分配给一个工作线程处理
      const urlChunks = [];
      for (let i = 0; i < numUrls; i += chunkSize) {
        const chunk = urls.slice(i, i + chunkSize);
        urlChunks.push(chunk);
      }

      // 创建工作线程
      const workers = [];
      for (let i = 0; i < NUM_WORKERS; i++) {
        const worker = new Worker(__filename, {
          workerData: urlChunks[i] || [], // 将每个工作线程分配的 URL 块作为 workerData 传递
        });
        workers.push(worker);
      }

      // 监听工作线程的消息，并将处理结果收集起来
      const preservedFiles = [];
      const preservedUrls = [];
      for (const worker of workers) {
        const result = await new Promise((resolve) => {
          worker.on('message', resolve);
        });
        preservedFiles.push(...result.preservedFiles);
        preservedUrls.push(...result.preservedUrls);
      }

      // 更新 URL 列表文件，将保留的 URL 写回文件
      fs.writeFileSync('urls', preservedUrls.join('\n'));
      console.log('更新后的 URL 列表已保存到文件！');

      console.log('所有网站内容保存完成！');
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  })();
}
// 工作线程逻辑
else {
  const urls = workerData;

  (async () => {
    try {
      const browser = await puppeteer.launch({
        executablePath: 'google-chrome-stable',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();

      page.setDefaultTimeout(5000);

      const preservedFiles = [];
      const preservedUrls = [];

      for (const url of urls) {
        try {
          await page.goto(url);

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
                preservedFiles.push(fileName);
                preservedUrls.push(url);
              }
            } catch (error) {}

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
                preservedFiles.push(fileName);
                preservedUrls.push(url);
              }
            } catch (error) {}

            if (!isJsonFile && !isYamlFile) {
              console.error(`获取的 ${url} 内容既不是 BASE64 编码也不符合特定格式，将跳过处理`);
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

      // 将结果发送回主线程
      parentPort.postMessage({ preservedFiles, preservedUrls });

      await browser.close();
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  })();
}

function isBase64(str) {
  const base64Regex = /^(data:.*?;base64,)?([A-Za-z0-9+/=])+$/;
  return base64Regex.test(str);
}

function isSpecialFormat(str) {
  const specialFormatRegex = /vmess:\/\/|trojan:\/\/|clash:\/\/|ss:\/\/|vlss:\/\//;
  return specialFormatRegex.test(str);
}
