const directoryPath = 'bata';
const urlsFilePath = 'urls';
const fs = require('fs');
const path = require('path');



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
    }
  });

  if (links.length > 0) {
    fs.appendFileSync(urlsFilePath, links.join('\n'));
    console.log(`链接已追加到文件 ${urlsFilePath}`);
  } else {
    console.log('没有找到链接需要追加到文件。');
  }
});
