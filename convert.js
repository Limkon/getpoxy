const fs = require('fs');
const base64 = require('base64-js');

function convertSubscriptionToUniversal(subscriptionConfig) {
  // 根据你的转换逻辑实现订阅转换
  // 这里只是一个示例，假设将原有订阅配置转换为通用订阅格式
  const { server, port, cipher, password, type } = subscriptionConfig;

  let convertedSubscription = '';
  if (type === 'ss') {
    convertedSubscription = `ss://${base64.fromByteArray(`${cipher}:${password}@${server}:${port}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
  } else if (type === 'ssr') {
    convertedSubscription = `ssr://${base64.fromByteArray(`${server}:${port}:${cipher}:${type}:${base64.fromByteArray(password)}:${base64.fromByteArray(password)}:${base64.fromByteArray('obfsparam')}?remarks=${base64.fromByteArray('remarks')}&group=${base64.fromByteArray('group')}`)}`;
  } else if (type === 'trojan') {
    convertedSubscription = `trojan://${base64.fromByteArray(`${password}@${server}:${port}`)}`;
  }

  return convertedSubscription;
}

function removeDuplicateSubscriptions(subscriptions) {
  const uniqueSubscriptions = new Set(subscriptions);
  return Array.from(uniqueSubscriptions);
}

function convertSubscriptions() {
  const subscriptionFiles = fs.readdirSync('data');

  const subscriptions = [];

  for (const file of subscriptionFiles) {
    const content = fs.readFileSync(`data/${file}`, 'utf-8').trim();

    // 解析订阅配置
    const subscriptionConfig = JSON.parse(content);
    // 转换订阅配置为通用格式
    const convertedSubscription = convertSubscriptionToUniversal(subscriptionConfig);

    subscriptions.push(convertedSubscription);
  }

  const mergedSubscriptions = removeDuplicateSubscriptions(subscriptions);

  return mergedSubscriptions.join('\n');
}

const mergedSubscriptions = convertSubscriptions();

console.log(mergedSubscriptions);

// 将合并后的订阅输出为 rest.txt 文件
fs.writeFileSync('result/rest.txt', mergedSubscriptions);

// 将合并后的订阅输出为输出参数，供 GitHub Actions 使用
console.log(`::set-output name=merged_subscriptions::${mergedSubscriptions}`);
