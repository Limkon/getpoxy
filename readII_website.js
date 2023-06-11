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
      .readFileSync('furls', 'utf-8')
      .split('\n')
      .map(url => url.trim())
      .filter(url => url !== '');

    for (const url of urls) {
      try {
        await page.goto(url);

        // 尝试不同的选择器
        const selectors = [
          '#app',                 // ID 选择器
          '.content',             // 类选择器
          'div',                  // 元素选择器
          '.my-class',            // 类选择器
          '#my-id',               // ID 选择器
          '[name="my-name"]',     // 属性选择器
          '.my-parent .my-child', // 后代选择器
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

        const date = moment().format('YYYY-MM-DD');
        const urlWithoutProtocol = url.replace(/^(https?:\/\/)/, '');
        const fileName = path.join('bata', `${urlWithoutProtocol.replace(/[:?<>|"*\r\n/]/g, '_')}_${date}.txt`);

        fs.writeFileSync(fileName, content);

        console.log(`网站 ${url} 内容已保存至文件：${fileName}`);
      } catch (error) {
        console.error(`处理 ${url} 失败：${error.message}`);
      }
    }

    await browser.close();
    console.log('所有网站内容保存完成！');

    // 提取链接并追加到文件中
    const directoryPath = 'bata';
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
        fs.writeFileSync(urlsFilePath, links.join('\n'));
        console.log(`链接已追加到文件 ${urlsFilePath}`);
      } else {
        console.log('没有找到链接需要追加到文件。');
      }
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
