import os
import base64

# 读取数据文件列表
data_dir = "data"  # 替换为你的数据文件所在目录
data_files = os.listdir(data_dir)

merged_content = []

# 遍历数据文件，逐个检测内容并处理
for file in data_files:
    file_path = os.path.join(data_dir, file)
    with open(file_path, "r") as f:
        content = f.read()

        if file.endswith(".json") or file.endswith(".yaml"):
            # 如果是 JSON 或 YAML 文件，直接跳过
            continue
        elif file.endswith(".txt"):
            try:
                # 尝试解密 Base64 编码的内容
                decoded_content = base64.b64decode(content).decode()
                merged_content.append(decoded_content)
            except Exception as e:
                # 内容不是 Base64 编码，跳过该文件并打印错误信息
                print(f"Error processing file {file}: {str(e)}")
                continue
        else:
            print(f"Warning: Unknown file type for file {file}")

# 保存合并后的内容到文件
output_dir = "result"  # 修改保存目录
os.makedirs(output_dir, exist_ok=True)  # 创建保存目录（如果不存在）
output_file = os.path.join(output_dir, "rest.txt")  # 修改保存文件名

with open(output_file, 'w') as file:
    for data in merged_content:
        file.write(data + '\n')

# 去除重复的行
unique_lines = set()
final_content = []
with open(output_file, 'r') as file:
    for line in file:
        line = line.strip()
        if line not in unique_lines:
            final_content.append(line)
            unique_lines.add(line)

# 保存去重后的内容到文件
with open(output_file, 'w') as file:
    for line in final_content:
        file.write(line + '\n')
