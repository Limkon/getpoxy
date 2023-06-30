import os
import re
import sys
import time
import datetime
import requests
import concurrent.futures
import base64
import json
import yaml

from bs4 import BeautifulSoup


def extract_content(url):
    response = requests.get(url)
    if response.status_code == 200:
        soup = BeautifulSoup(response.text, 'html.parser')
        # 在此编写选择和提取页面内容的代码
        # 例如：提取页面的文本内容
        content = soup.get_text()
        return content
    else:
        raise Exception(f"Failed to fetch content from URL: {url}")


def save_content(content, output_dir, url):
    date = datetime.datetime.now().strftime('%Y-%m-%d')
    url_without_protocol = re.sub(r'^(https?://)', '', url)
    file_name = os.path.join(output_dir, re.sub(r'[:?<>|\"*\r\n/]', '_', url_without_protocol) + "_" + date + ".txt")
    with open(file_name, 'w', encoding='utf-8') as file:
        file.write(content)
    print(f"网站 {url} 内容已保存至文件：{file_name}")
    return file_name


def process_url(url, output_dir, rest_urls_file):
    try:
        content = extract_content(url)
        if is_yaml(content):
            file_name = save_content(content, output_dir, url)
            return f"处理 {url} 成功", file_name
        elif is_json(content):
            file_name = save_content(content, output_dir, url)
            return f"处理 {url} 成功", file_name
        elif has_specific_format(content):
            file_name = save_content(content, output_dir, url)
            return f"处理 {url} 成功", file_name
        elif is_base64_encoded(content):
            file_name = save_content(content, output_dir, url)
            return f"处理 {url} 成功", file_name
        else:
            extract_and_save_links(content, rest_urls_file)
            return f"处理 {url} 成功", None
    except Exception as e:
        return f"处理 {url} 失败：{str(e)}", None


def is_yaml(content):
    try:
        yaml.safe_load(content)
        return True
    except yaml.YAMLError:
        return False


def is_json(content):
    try:
        json.loads(content)
        return True
    except ValueError:
        return False


def has_specific_format(content):
    formats = ['vmess://', 'trojan://', 'clash://', 'ss://', 'vlss://']
    return any(format in content for format in formats)


def is_base64_encoded(content):
    try:
        base64.b64decode(content)
        return True
    except base64.binascii.Error:
        return False


def extract_and_save_links(content, rest_urls_file):
    urls = re.findall(r'(https?://\S+)', content)
    with open(rest_urls_file, 'a', encoding='utf-8') as file:
        for url in urls:
            file.write(url + '\n')


def process_urls(urls, output_dir, num_threads, rest_urls_file):
    with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = [executor.submit(process_url, url, output_dir, rest_urls_file) for url in urls]

        for future in concurrent.futures.as_completed(futures):
            result, file_name = future.result()
            print(result)
            if file_name:
                os.remove(file_name)


def main():
    if len(sys.argv) != 5:
        print("请提供要抓取的 URL 列表文件名、保存提取内容的目录、线程数和剩余 URL 文件名")
        print("示例: python extract_urls.py urls.txt data 10 rest_urls.txt")
        sys.exit(1)

    urls_file = sys.argv[1]  # 存储要抓取的 URL 列表的文件名
    output_dir = sys.argv[2]  # 保存提取内容的目录
    num_threads = int(sys.argv[3])  # 线程数
    rest_urls_file = sys.argv[4]  # 剩余 URL 文件名

    with open(urls_file, 'r', encoding='utf-8') as file:
        urls = [line.strip() for line in file]

    process_urls(urls, output_dir, num_threads, rest_urls_file)

    print('所有网站内容保存完成！')


if __name__ == '__main__':
    main()
