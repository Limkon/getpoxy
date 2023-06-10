import requests
from bs4 import BeautifulSoup
import os

def extract_subscription_urls(search_query):
    search_url = f"https://www.google.com/search?q={search_query}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    response = requests.get(search_url, headers=headers)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    search_results = soup.find_all("a")

    subscription_urls = []
    for result in search_results:
        href = result.get("href")
        if href and href.startswith("http"):
            subscription_urls.append(href)

    return subscription_urls

# 从环境变量中获取搜索关键字
search_query = os.getenv("SEARCH_QUERY", "订阅节点")
urls = extract_subscription_urls(search_query)

# 打印提取到的订阅地址
for url in urls:
    print(url)

# 将提取到的订阅地址追加保存到文件中
with open("urls", "a") as file:
    file.write("\n".join(urls) + "\n")
