const fs = require('fs');
const path = require('path');
const moment = require('moment');
const puppeteer = require('puppeteer-core');
const yaml = require('js-yaml');

(async () => {
  try {
    const browser = await puppeteer.launch({
      executablePath: 'google-chrome-stable',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    // Set the page timeout to 5000 milliseconds
    page.setDefaultTimeout(5000);

    // Read the file to get the list of URLs to scrape
    const urls = fs
      .readFileSync('urls', 'utf-8')
      .split('\n')
      .map(url => url.trim())
      .filter(url => url !== '');

    const preservedFiles = []; // Store the preserved files
    const preservedUrls = []; // Store the preserved URLs

    for (const url of urls) {
      try {
        await page.goto(url);

        const selectors = [
          '#app', // ID selector
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
            console.error(`Failed to retrieve content from ${url} using selector ${selector}: ${error.message}`);
          }
        }

        if (!success) {
          console.error(`Unable to retrieve content from ${url} using any of the selectors. Executing custom code.`);

          const customContent = await page.evaluate(() => {
            // Write custom JavaScript code here to select and extract page content
            // For example: return the innerText of the entire page
            return document.documentElement.innerText;
          });

          if (customContent) {
            content = customContent;
            console.log(`Successfully extracted content from ${url} using custom code.`);
          } else {
            console.error(`Custom code failed to retrieve content from ${url}.`);
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
              const fileName = path.join('json_files', `${sanitizeFileName(url)}_${date}.json`);
              fs.writeFileSync(fileName, content);
              console.log(`Website ${url} content is a JSON file, saved to: ${fileName}`);

              preservedFiles.push(fileName);
              preservedUrls.push(url);
            }
          } catch (error) {
            // Not a valid JSON file
          }

          let isYamlFile = false;
          try {
            const yamlContent = yaml.safeLoad(content);
            if (yamlContent && typeof yamlContent === 'object') {
              isYamlFile = true;
              const date = moment().format('YYYY-MM-DD');
              const fileName = path.join('yaml_files', `${sanitizeFileName(url)}_${date}.yaml`);
              fs.writeFileSync(fileName, content);
              console.log(`Website ${url} content is a YAML file, saved to: ${fileName}`);

              preservedFiles.push(fileName);
              preservedUrls.push(url);
            }
          } catch (error) {
            // Not a valid YAML file
          }

          if (!isJsonFile && !isYamlFile) {
            const urlIndex = preservedUrls.indexOf(url);
            if (urlIndex !== -1) {
              preservedUrls.splice(urlIndex, 1);
            }
            console.error(`The content retrieved from ${url} is neither BASE64 encoded nor in a special format. Skipping.`);
            continue;
          }
        }

        const date = moment().format('YYYY-MM-DD');
        const fileName = path.join('data', `${sanitizeFileName(url)}_${date}.txt`);

        fs.writeFileSync(fileName, content);

        preservedFiles.push(fileName);
        preservedUrls.push(url);
        console.log(`Website ${url} content saved to file: ${fileName}`);
      } catch (error) {
        console.error(`Failed to process ${url}: ${error.message}`);
      }
    }

    fs.writeFileSync('urls', preservedUrls.join('\n'));
    console.log('Updated URL list saved to file!');

    await browser.close();
    console.log('All website contents saved!');
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
  const specialFormatRegex = /vmess:\/\/|trojan:\/\/|clash:\/\/|ss:\/\/|vlss:\/\//;
  return specialFormatRegex.test(str);
}

function sanitizeFileName(url) {
  const urlWithoutProtocol = url.replace(/^(https?:\/\/)/, '');
  return urlWithoutProtocol.replace(/[:?<>|"*\r\n/]/g, '_');
}
