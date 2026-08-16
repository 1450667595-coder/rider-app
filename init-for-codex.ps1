# 🎯 Codex 初始化脚本 (适用于 Windows PowerShell)
# 作用：一键下载项目、安装依赖、启动开发环境
# 作者：Trae AI (项目监工)
# 使用方法：右键点击此脚本 -> "使用 PowerShell 运行"

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " 骑手工作台 · Codex 开发环境初始化" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 Node.js
Write-Host "[1/5] 检查 Node.js 环境..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    $npmVersion = npm --version
    Write-Host "  ✅ Node.js: $nodeVersion" -ForegroundColor Green
    Write-Host "  ✅ npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ 未检测到 Node.js，请先安装 https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# 2. 获取项目代码
Write-Host ""
Write-Host "[2/5] 获取项目代码..." -ForegroundColor Yellow
$projectDir = "$env:USERPROFILE\Desktop\rider-workbench"

if (Test-Path $projectDir) {
    Write-Host "  ⚠️  项目目录已存在: $projectDir" -ForegroundColor Yellow
    $response = Read-Host "  是否使用现有目录？(Y/N)"
    if ($response -ne "Y") {
        $newDir = Read-Host "  请输入新目录路径"
        $projectDir = $newDir
    }
}

if (-not (Test-Path $projectDir)) {
    Write-Host "  正在下载项目..." -ForegroundColor Cyan
    $zipUrl = "https://github.com/1450667595-coder/rider-app/archive/refs/heads/master.zip"
    $zipPath = "$env:TEMP\rider-app.zip"
    
    # 尝试使用 curl 下载（Windows 10+ 自带）
    if (Get-Command curl -ErrorAction SilentlyContinue) {
        curl -L -o $zipPath $zipUrl
    } else {
        # 使用 PowerShell 原生命令
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
    }
    
    if (-not (Test-Path $zipPath)) {
        Write-Host "  ❌ 下载失败，请检查网络连接" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  正在解压..." -ForegroundColor Cyan
    Expand-Archive -Path $zipPath -DestinationPath "$env:TEMP\rider-app-temp" -Force
    # GitHub ZIP 解压后会有一层目录，需要移动内容
    $extractedDir = Get-ChildItem "$env:TEMP\rider-app-temp" | Select-Object -First 1
    Move-Item $extractedDir.FullName $projectDir
    Remove-Item "$env:TEMP\rider-app-temp" -Recurse -Force
    Remove-Item $zipPath -Force
    Write-Host "  ✅ 项目已下载到: $projectDir" -ForegroundColor Green
} else {
    Write-Host "  ✅ 使用现有目录: $projectDir" -ForegroundColor Green
}

# 3. 安装依赖
Write-Host ""
Write-Host "[3/5] 安装前端依赖..." -ForegroundColor Yellow
Push-Location $projectDir
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ 前端依赖安装失败" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "  ✅ 前端依赖安装完成" -ForegroundColor Green

Write-Host ""
Write-Host "[4/5] 安装后端依赖..." -ForegroundColor Yellow
Push-Location server
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ 后端依赖安装失败" -ForegroundColor Red
    Pop-Location
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "  ✅ 后端依赖安装完成" -ForegroundColor Green

# 4. 验证构建
Write-Host ""
Write-Host "[5/5] 验证生产构建..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ 构建失败，请检查错误日志" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "  ✅ 生产构建成功" -ForegroundColor Green

# 5. 完成
Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "  🎉 初始化完成！" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "下一步操作：" -ForegroundColor Yellow
Write-Host "  1. 进入项目目录: cd $projectDir" -ForegroundColor White
Write-Host "  2. 查看开发手册: 打开 AGENT_CONTEXT.md" -ForegroundColor White
Write-Host "  3. 启动开发环境: npm run dev:all" -ForegroundColor White
Write-Host ""
Write-Host "如需单独启动：" -ForegroundColor Cyan
Write-Host "  前端: npm run dev (端口 5173)" -ForegroundColor White
Write-Host "  后端: npm run dev:server (端口 3001)" -ForegroundColor White
Write-Host ""
Write-Host "线上版本预览:" -ForegroundColor Cyan
Write-Host "  https://1450667595-coder.github.io/rider-app/" -ForegroundColor White
Write-Host ""
