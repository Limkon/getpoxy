const fs = require('fs');
const path = require('path');
const moment = require('moment');
const puppeteer = require('puppeteer-core');
const PQueue = require('p-queue');
const limit = new PQueue({ concurrency: concurrencyLimit });

const concurrencyLimit = 15; // 同时处理的最大请求数

(async () => {
  try {
    const browser = await puppeteer.launch({
      executablePath: 'google-chrome-stable',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const urls = fs
      .readFileSync('urls', 'utf-8')
      .split('\n')
      .map(url => url.trim())
      .filter(url => url !== '');

    const limiter = limit(concurrencyLimit);

    await Promise.all(urls.map(async (url) => {
      await limiter(async () => {
        try {
          const page = await browser.newPage();
          // 设置页面的默认超时时间为2秒
          page.setDefaultTimeout(2000);

          await page.goto(url);

          const selectors = [
            '#app',                 // ID 选择器        
          ];

          let content = '';
          let success = false;

          for (const selector of selectors) {
            try {
              // 等待页面中的特定元素出现，超时时间设置为3秒
              await page.waitForSelector(selector, { timeout: 3000 });
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
              return;
            }
          }

          const date = moment().format('YYYY-MM-DD');
          const urlWithoutProtocol = url.replace(/^(https?:\/\/)/, '');
          const fileName = path.join('data', `${urlWithoutProtocol.replace(/[:?<>|"*\r\n/]/g, '_')}_${date}.txt`);

          fs.writeFileSync(fileName, content);

          console.log(`网站 ${url} 内容已保存至文件：${fileName}`);

          await page.close();
        } catch (error) {
          console.error(`处理 ${url} 失败：${error.message}`);
        }
      });
    }));

    console.log('所有网站内容保存完成！');

    const directoryPath = 'data';
    const urlsFilePath = 'urls';

    fs.readdir(directoryPath, (err, files) => {
      if (err) {
        console.error(`无法读取目录 ${directoryPath}：${err}`);
        return;
      }

      const linkRegex = /(https?:\/\/[^\s]+)/g;
      const links = [];

      files.forEach((file) => {
        const filePath = path.join(directoryPath, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const extractedLinks = fileContent.match(linkRegex);

        if (extractedLinks) {
          links.push(...extractedLinks);
          console.log(`在文件 ${file} 中找到以下链接：`);
          console.log(extractedLinks);
        }
      });

      if (links.length > 0) {
        fs.appendFileSync(urlsFilePath, links.join('\n'));
        console.log(`链接已追加到文件 ${urlsFilePath}`);
      } else {
        console.log('没有找到链接需要追加到文件。');
      }
    });

    await browser.close();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
