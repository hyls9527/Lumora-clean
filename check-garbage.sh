#!/bin/bash
# 检测源文件中的 bash 错误信息污染
echo "=== 检测源文件污染 ==="
count=$(grep -rn 'usr/bin/bash\|hermes-snap\|hermes-cwd' src/ --include='*.tsx' --include='*.ts' --include='*.css' 2>/dev/null | wc -l)

if [ "$count" -gt 0 ]; then
    echo "发现 $count 行垃圾！"
    grep -rn 'usr/bin/bash\|hermes-snap\|hermes-cwd' src/ --include='*.tsx' --include='*.ts' --include='*.css'
    echo ""
    echo "修复方法: 读取文件，过滤垃圾行，重新写入"
    exit 1
else
    echo "✅ 未发现垃圾行"
    exit 0
fi
