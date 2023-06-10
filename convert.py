import os
import base64

# 读取数据文件列表
data_dir = "data"  # 替换为你的数据文件所在目录
data_files = os.listdir(data_dir)

merged_content = set()

# 遍历数据文件，逐个检测内容并处理
for file in data_files:
    file_path = os.path.join(data_dir, file)
    with open(file_path, "r") as f:
        content = f.read()

        try:
            # 尝试解密 Base64 编码的内容
            decoded_content = base64.b64decode(content).decode()
            merged_content.add(decoded_content)
        except base64.binascii.Error:
            # 文件内容不是 Base64 编码，跳过该文件
            continue

# 输出合并且去重后的结果到文件
output_dir = "result"  # 修改保存目录
os.makedirs(output_dir, exist_ok=True)  # 创建保存目录（如果不存在）
output_file = os.path.join(output_dir, "rest.txt")  # 修改保存文件名

with open(output_file, 'w') as file:
    for data in merged_content:
        file.write(data + '\n')
