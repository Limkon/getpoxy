import os
import base64
import socket

# 测试网址信息
node_ip = "google.com"
node_port = 80

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
                # 内容不是 Base64 编码，继续检测是否符合特定格式
                if content.startswith("vmess://") or content.startswith("clash://") or content.startswith("ss://") or content.startswith("vlss://"):
                    merged_content.append(content)
                else:
                    # 内容既不是 Base64 编码也不符合特定格式，跳过该文件并打印错误信息
                    print(f"Error processing file {file}: Content is neither Base64 encoded nor has a special format.")
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

# 去除重复的行和空白行
unique_lines = set()
final_content = []
with open(output_file, 'r') as file:
    for line in file:
        line = line.strip()
        if line and line not in unique_lines:
            final_content.append(line)
            unique_lines.add(line)

# 保存去重后的内容到文件
with open(output_file, 'w') as file:
    for line in final_content:
        file.write(line + '\n')

# 进行节点连接测试
tested_content = []
for line in final_content:
    try:
        with socket.create_connection((node_ip, node_port), timeout=5) as sock:
            tested_content.append(line)
    except socket.error as e:
        print(f"Error connecting to node {node_ip}:{node_port}: {str(e)}")

# 保存测试后的内容到文件
tested_output_file = os.path.join(output_dir, "tested_rest.txt")  # 修改保存文件名
with open(tested_output_file, 'w') as file:
    for line in tested_content:
        file.write(line + '\n')

# 将最终结果 tested_rest.txt 使用 BASE64 编码后保存到 share/tongyy 文件中
output_share_dir = "share"  # 修改分享目录
os.makedirs(output_share_dir, exist_ok=True)  # 创建分享目录（如果不存在）
output_share_file = os.path.join(output_share_dir, "tongyy")  # 修改保存文件名

# 将最终内容进行 BASE64 编码
encoded_content = base64.b64encode('\n'.join(tested_content).encode()).decode()

# 保存编码后的内容到文件
with open(output_share_file, 'w') as file:
    file.write(encoded_content)

print(f"最终结果已经以 BASE64 编码保存至文件: {output_share_file}")
