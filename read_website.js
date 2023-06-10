const fs = require('fs');
const path = require('path');
const moment = require('moment');
const puppeteer = require('puppeteer-core');

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

    const successfulUrls = [];
    const failedUrls = [];

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
            failedUrls.push(url);
            continue;
          }
        }

        // 检测内容是否为 BASE64 编码或特定格式
        if (!isBase64(content) && !isSpecialFormat(content)) {
          console.error(`获取的 ${url} 内容既不是 BASE64 编码也不符合特定格式，将从 URL 列表中删除`);
          failedUrls.push(url);
          continue;
        }

        const date = moment().format('YYYY-MM-DD');
        const urlWithoutProtocol = url.replace(/^(https?:\/\/)/, '');
        const fileName = path.join('data', `${urlWithoutProtocol.replace(/[:?<>|"*\r\n/]/g, '_')}_${date}.txt`);

        fs.writeFileSync(fileName, content);

        successfulUrls.push(url);
        console.log(`网站 ${url} 内容已保存至文件：${fileName}`);
      } catch (error) {
        console.error(`处理 ${url} 失败：${error.message}`);
        failedUrls.push(url);
      }
    }

    // 更新 URL 列表文件
    updateUrlsFile(failedUrls);

    await browser.close();
    console.log('所有网站内容保存完成！');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();

function isBase64(str) {
  const base64Regex = /^(data:.*?;base64,)?([A-Za-z0-9+/=])+$/;
  return base64Regex.test(str);
}

function isSpecialFormat(str) {
  const specialFormatRegex = /vmess:\/\/|clash:\/\/|ss:\/\/|vlss:\/\/;
  return specialFormatRegex.test(str);
}

function updateUrlsFile(failedUrls) {
  const originalUrls = fs
    .readFileSync('urls', 'utf-8')
    .split('\n')
    .map(url => url.trim());

  const updatedUrls = originalUrls.filter(url => !failedUrls.includes(url));

  fs.writeFileSync('urls', updatedUrls.join('\n'));
  console.log('更新后的 URL 列表已保存到文件！');
}
