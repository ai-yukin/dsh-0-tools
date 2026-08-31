# 微信公众号草稿推送脚本
# 功能：上传封面图+文章图片，替换HTML中的图片链接，推送到草稿箱

$ErrorActionPreference = "Stop"

# ========== 配置 ==========
$AppID = "wx3603c0e7f8984d82"
$AppSecret = "3416d4a404ce19ffcf861cfef70b6a9a"
$baseDir = "E:\WorkBuddy工作空间\DeepSeek-Harness\插件\dsh-0-tools-fix"
$htmlFile = "$baseDir\article\零号工具推荐文章.html"
$coverFile = "$baseDir\article\cover.jpg"
$screenshotsDir = "$baseDir\screenshots"

# 文章元信息
$articleTitle = "零门槛零费用！14岁女生的GitHub处女作——手把手教你3分钟玩转DeepSeek Harness"
$articleAuthor = "钰婷（Yukin）"
$articleDigest = "14岁初中女生的GitHub处女作！一键安装DeepSeek Harness，一键配置智谱+OpenRouter双免费模型池，零门槛零费用开启AI编程之旅。"

# ========== 1. 获取 access_token ==========
Write-Host "=== [1/5] 获取 access_token ===" -ForegroundColor Cyan
$tokenUrl = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=$AppID&secret=$AppSecret"
$tokenResp = Invoke-RestMethod -Uri $tokenUrl -Method Get -TimeoutSec 15
if (-not $tokenResp.access_token) {
    Write-Host "获取token失败: $($tokenResp.errcode) - $($tokenResp.errmsg)" -ForegroundColor Red
    exit 1
}
$accessToken = $tokenResp.access_token
Write-Host "access_token 获取成功，有效期 $($tokenResp.expires_in) 秒" -ForegroundColor Green

# ========== 辅助函数：multipart 文件上传 ==========
function Upload-FileMultipart {
    param([string]$Url, [string]$FilePath, [string]$FieldName = "media")
    
    $fileBytes = [System.IO.File]::ReadAllBytes($FilePath)
    $fileName = [System.IO.Path]::GetFileName($FilePath)
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    
    $bodyLines = @(
        "--$boundary",
        "Content-Disposition: form-data; name=`"$FieldName`"; filename=`"$fileName`"",
        "Content-Type: application/octet-stream",
        ""
    )
    $bodyHeader = [System.Text.Encoding]::UTF8.GetBytes(($bodyLines -join $LF))
    $bodyFooter = [System.Text.Encoding]::UTF8.GetBytes("$LF--$boundary--$LF")
    
    $ms = New-Object System.IO.MemoryStream
    $ms.Write($bodyHeader, 0, $bodyHeader.Length)
    $ms.Write($fileBytes, 0, $fileBytes.Length)
    $ms.Write($bodyFooter, 0, $bodyFooter.Length)
    $bodyBytes = $ms.ToArray()
    $ms.Close()
    
    $headers = @{ "Content-Type" = "multipart/form-data; boundary=$boundary" }
    $resp = Invoke-RestMethod -Uri $Url -Method Post -Headers $headers -Body $bodyBytes -TimeoutSec 30
    return $resp
}

# ========== 2. 上传封面图为永久素材 ==========
Write-Host ""
Write-Host "=== [2/5] 上传封面图为永久素材 ===" -ForegroundColor Cyan
$coverUrl = "https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=$accessToken&type=image"
$coverResp = Upload-FileMultipart -Url $coverUrl -FilePath $coverFile
if (-not $coverResp.media_id) {
    Write-Host "封面图上传失败: $($coverResp.errcode) - $($coverResp.errmsg)" -ForegroundColor Red
    exit 1
}
$thumbMediaId = $coverResp.media_id
Write-Host "封面图上传成功，media_id: $thumbMediaId" -ForegroundColor Green

# ========== 3. 上传文章内5张截图 ==========
Write-Host ""
Write-Host "=== [3/5] 上传文章内截图 ===" -ForegroundColor Cyan
$imageUrlMap = @{}
for ($i = 1; $i -le 5; $i++) {
    $imgFile = "$screenshotsDir\$i.png"
    if (Test-Path $imgFile) {
        $uploadUrl = "https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=$accessToken"
        $imgResp = Upload-FileMultipart -Url $uploadUrl -FilePath $imgFile
        if ($imgResp.url) {
            $imageUrlMap["../screenshots/$i.png"] = $imgResp.url
            $imageUrlMap["screenshots/$i.png"] = $imgResp.url
            Write-Host "  $i.png 上传成功: $($imgResp.url.Substring(0,50))..." -ForegroundColor Green
        } else {
            Write-Host "  $i.png 上传失败: $($imgResp.errcode) - $($imgResp.errmsg)" -ForegroundColor Red
        }
    }
}

# ========== 4. 读取HTML并替换图片链接 ==========
Write-Host ""
Write-Host "=== [4/5] 读取HTML并替换图片链接 ===" -ForegroundColor Cyan
$htmlContent = [System.IO.File]::ReadAllText($htmlFile, [System.Text.Encoding]::UTF8)
foreach ($key in $imageUrlMap.Keys) {
    $htmlContent = $htmlContent.Replace($key, $imageUrlMap[$key])
}
Write-Host "HTML内容读取并替换完成，长度: $($htmlContent.Length) 字符" -ForegroundColor Green

# ========== 5. 推送到草稿箱 ==========
Write-Host ""
Write-Host "=== [5/5] 推送到草稿箱 ===" -ForegroundColor Cyan
$draftUrl = "https://api.weixin.qq.com/cgi-bin/draft/add?access_token=$accessToken"

$article = @{
    title = $articleTitle
    author = $articleAuthor
    digest = $articleDigest
    content = $htmlContent
    content_source_url = ""
    thumb_media_id = $thumbMediaId
    need_open_comment = 1
    only_fans_can_comment = 0
}
$payload = @{ articles = @($article) } | ConvertTo-Json -Depth 5 -Compress

# 确保JSON是UTF-8编码
$payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
$draftResp = Invoke-RestMethod -Uri $draftUrl -Method Post -Body $payloadBytes -ContentType "application/json; charset=utf-8" -TimeoutSec 30

if ($draftResp.media_id) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  草稿推送成功！" -ForegroundColor Green
    Write-Host "  草稿 media_id: $($draftResp.media_id)" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "请登录微信公众平台，在「内容管理」→「草稿箱」中查看和发布。" -ForegroundColor Yellow
} else {
    Write-Host "草稿推送失败: $($draftResp.errcode) - $($draftResp.errmsg)" -ForegroundColor Red
    exit 1
}
