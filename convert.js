const fs = require('fs');
const base64 = require('base64-js');

function convertSubscriptionToUniversal(subscriptionConfig) {
  const { server, port, cipher, password, type } = subscriptionConfig;
  let convertedSubscription = '';

  if (type === 'ss') {
    const ssConfig = `${cipher}:${password}@${server}:${port}`;
    const base64SSConfig = base64.fromByteArray(Buffer.from(ssConfig, 'utf-8'));
    convertedSubscription = `ss://${base64SSConfig.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
  } else if (type === 'ssr') {
    const ssrConfig = `${server}:${port}:${cipher}:${type}:${password}:${password}:obfsparam?remarks=remarks&group=group`;
    const base64SSRConfig = base64.fromByteArray(Buffer.from(ssrConfig, 'utf-8'));
    convertedSubscription = `ssr://${base64SSRConfig}`;
  } else if (type === 'trojan') {
    const trojanConfig = `${password}@${server}:${port}`;
    const base64TrojanConfig = base64.fromByteArray(Buffer.from(trojanConfig, 'utf-8'));
    convertedSubscription = `trojan://${base64TrojanConfig}`;
  }

  return convertedSubscription;
}

function removeDuplicateSubscriptions(subscriptions) {
  const uniqueSubscriptions = [...new Set(subscriptions)];
  return uniqueSubscriptions;
}

function convertSubscriptions() {
  const subscriptionFiles = fs.readdirSync('data');
  const subscriptions = [];

  for (const file of subscriptionFiles) {
    const content = fs.readFileSync(`data/${file}`, 'utf-8').trim();

    try {
      const subscriptionConfig = JSON.parse(content);
      const convertedSubscription = convertSubscriptionToUniversal(subscriptionConfig);
      subscriptions.push(convertedSubscription);
    } catch (error) {
      console.log(`Error parsing JSON file: ${file}`);
      console.log(error);
    }
  }

  const mergedSubscriptions = removeDuplicateSubscriptions(subscriptions);
  return mergedSubscriptions.join('\n');
}

try {
  const mergedSubscriptions = convertSubscriptions();
  console.log(mergedSubscriptions);

  fs.writeFileSync('result/rest.txt', mergedSubscriptions);
  console.log(`::set-output name=merged_subscriptions::${mergedSubscriptions}`);
} catch (error) {
  console.log('An error occurred while processing subscriptions:');
  console.log(error);
}
