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
            # 处理JSON文件
            try:
                data = json.loads(content)
                merged_content.add(json.dumps(data))
            except ValueError:
                print(f"Error: Invalid JSON format in file {file}")
        elif file.endswith(".yaml"):
            # 处理YAML文件
            try:
                data = yaml.safe_load(content)
                merged_content.add(yaml.dump(data))
            except yaml.YAMLError:
                print(f"Error: Invalid YAML format in file {file}")
        elif file.endswith(".txt"):
            # 处理文本文件
            merged_content.add(content)
        else:
            print(f"Warning: Unknown file type for file {file}")

# 转换为Base64编码
converted_content = []
for content in merged_content:
    encoded_content = base64.b64encode(content.encode()).decode()
    converted_content.append(encoded_content)

# 输出合并且转换为Base64编码的结果到文件
output_dir = "result"  # 修改保存目录
output_file = os.path.join(output_dir, "rest.txt")  # 修改保存文件名

with open(output_file, 'w') as file:
    for data in converted_content:
        file.write(data + '\n')
