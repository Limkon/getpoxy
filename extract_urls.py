import requests
import random
from bs4 import BeautifulSoup

def extract_subscription_urls(search_query, search_engine):
    if search_engine == "google":
        search_url = f"https://www.google.com/search?q={search_query}"
    elif search_engine == "bing":
        search_url = f"https://www.bing.com/search?q={search_query}"
    else:
        raise ValueError("Invalid search engine")

    # 随机选择User-Agent标头
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36"
    ]
    user_agent = random.choice(user_agents)
    headers = {"User-Agent": user_agent}

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

# 从环境变量中获取搜索关键字和搜索引擎
search_query = os.getenv("SEARCH_QUERY", "订阅节点")
search_engine = os.getenv("SEARCH_ENGINE", "google")

# 使用Google搜索并随机调整请求头信息
if search_engine == "google":
    urls = extract_subscription_urls(search_query, "google")
    print("Google Search Results:")
    for url in urls:
        print(url)

# 使用必应搜索并随机调整请求头信息
elif search_engine == "bing":
    urls = extract_subscription_urls(search_query, "bing")
    print("Bing Search Results:")
    for url in urls:
        print(url)

# 保存提取到的订阅地址到文件中
with open("furls", "w") as file:
    file.write("\n".join(urls) + "\n")
