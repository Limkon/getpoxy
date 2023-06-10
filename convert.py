import os
import base64
import json
import yaml

# 读取数据文件列表
data_dir = "data"  # 替换为你的数据文件所在目录
data_files = os.listdir(data_dir)

merged_content = set()

# 遍历数据文件，合并内容并去重
for file in data_files:
    file_path = os.path.join(data_dir, file)
    with open(file_path, "r") as f:
        content = f.read()

        # 判断文件类型
        if file.endswith(".json"):
            # 跳过处理JSON文件
            continue
        elif file.endswith(".yaml"):
            # 跳过处理YAML文件
            continue
        elif file.endswith(".txt"):
            # 处理文本文件
            merged_content.add(content)
        elif file.endswith(".base64"):
            # 解密Base64编码的内容
            try:
                decoded_content = base64.b64decode(content).decode()
                merged_content.add(decoded_content)
            except base64.binascii.Error:
                print(f"Error: Invalid Base64 encoding in file {file}")
        else:
            print(f"Warning: Unknown file type for file {file}")

# 输出合并且去重后的结果到文件
output_dir = "result"  # 修改保存目录
output_file = os.path.join(output_dir, "rest.txt")  # 修改保存文件名

with open(output_file, 'w') as file:
    for data in merged_content:
        file.write(data + '\n')
