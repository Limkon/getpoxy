const fs = require('fs');
const base64 = require('base64-js');

function convertSubscriptionToUniversal(subscriptionUrl) {
  // 根据你的转换逻辑实现订阅转换
  // 这里只是一个示例，假设将非通用订阅链接转换为通用订阅链接
  if (!subscriptionUrl.startsWith('universal://')) {
    return `universal://${subscriptionUrl}`;
  }

  // 如果链接已经是通用订阅链接，则直接返回
  return subscriptionUrl;
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

    // 检测订阅类型，根据需要调整判断逻辑
    if (content.startsWith('vmess://') || content.startsWith('ss://')) {
      const decodedSubscription = base64.toByteArray(content).toString('utf-8');
      subscriptions.push(decodedSubscription);
    } else {
      subscriptions.push(content);
    }
  }

  const convertedSubscriptions = subscriptions.map(convertSubscriptionToUniversal);
  const mergedSubscriptions = removeDuplicateSubscriptions(convertedSubscriptions);

  return mergedSubscriptions.join('\n');
}

const mergedSubscriptions = convertSubscriptions();

console.log(mergedSubscriptions);

// 将合并后的订阅输出为 rest.txt 文件
fs.writeFileSync('result/rest.txt', mergedSubscriptions);

// 将合并后的订阅输出为输出参数，供 GitHub Actions 使用
console.log(`::set-output name=merged_subscriptions::${mergedSubscriptions}`);
