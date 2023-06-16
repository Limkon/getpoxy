import os
import sys
import re

def remove_non_alphanumeric_urls(filename):
    lines_to_keep = []

    with open(filename, 'r') as file:
        for line in file:
            line = line.strip()

            # 检查行是否只包含字母和数字
            if re.match(r'^[a-zA-Z0-9]+$', line):
                lines_to_keep.append(line)

    # 将结果写回原文件
    with open(filename, 'w') as file:
        file.write('\n'.join(lines_to_keep))

    print("已剔除包含非字母或数字字符的网址。")

# 获取命令行参数
if len(sys.argv) != 2:
    print("Usage: python remove_non_alphanumeric_urls.py <filename>")
else:
    filename = sys.argv[1]  # 获取文件名参数
    remove_non_alphanumeric_urls(filename)  # 调用剔除函数，传入文件名参数
