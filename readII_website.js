const fs = require('fs');
const path = require('path');
const moment = require('moment');
const puppeteer = require('puppeteer-core');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const NUM_THREADS = 10; // 定义线程池中的线程数量

if (isMainThread) {
  mainThread();
} else {
  workerThread(workerData);
}

async function mainThread() {
  try {
    const urls = fs
      .readFileSync('urls', 'utf-8')
      .split('\n')
      .map(url => url.trim())
      .filter(url => url !== '');

    // 创建一个线程池，并将URL列表分配给不同的线程
    const threadPool = new Set();
    const results = [];

    for (let i = 0; i < NUM_THREADS; i++) {
      const worker = new Worker(__filename, { workerData: urls.splice(0, urls.length / NUM_THREADS) });
      threadPool.add(worker);
    }

    // 监听线程的消息事件，收集处理结果
    for (const worker of threadPool) {
      worker.on('message', result => {
        results.push(result);
      });

      worker.on('error', error => {
        console.error(`线程处理失败：${error}`);
      });

      worker.on('exit', () => {
        threadPool.delete(worker);
        if (threadPool.size === 0) {
          // 所有线程都完成了任务，继续后续操作
          processResults(results);
        }
      });
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

async function workerThread(urls) {
  try {
    const browser = await puppeteer.launch({
      executablePath: 'google-chrome-stable',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    page.setDefaultTimeout(5000);

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

        const date = moment().format('YYYY-MM-DD');
        const urlWithoutProtocol = url.replace(/^(https?:\/\/)/, '');
        const fileName = path.join('bata', `${urlWithoutProtocol.replace(/[:?<>|"*\r\n/]/g, '_')}_${date}.txt`);

        fs.writeFileSync(fileName, content);
        console.log(`网站 ${url} 内容已保存至文件：${fileName}`);

        // 将处理结果发送给主线程
        parentPort.postMessage({ url, success: true, fileName });
      } catch (error) {
        console.error(`处理 ${url} 失败：${error.message}`);
        // 将处理结果发送给主线程
        parentPort.postMessage({ url, success: false });
      }
    }

    await browser.close();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

function processResults(results) {
  const directoryPath = 'bata';
  const urlsFilePath = 'urls';
  const linkRegex = /(https?:\/\/[^\s]+)/g;
  const links = [];

  results.forEach(result => {
    const { url, success, fileName } = result;
    if (success) {
      const fileContent = fs.readFileSync(fileName, 'utf-8');
      const extractedLinks = fileContent.match(linkRegex);
      if (extractedLinks) {
        links.push(...extractedLinks);
        console.log(`在文件 ${fileName} 中找到以下链接：`);
        console.log(extractedLinks);
      }
    } else {
      console.error(`处理 ${url} 失败`);
    }
  });

  if (links.length > 0) {
    fs.appendFileSync(urlsFilePath, links.join('\n'));
    console.log(`链接已追加到文件 ${urlsFilePath}`);
  } else {
    console.log('没有找到链接需要追加到文件。');
  }
}
