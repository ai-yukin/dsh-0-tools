# -*- coding: utf-8 -*-
"""
微信公众号草稿推送脚本
功能：上传封面图+文章图片，替换HTML中的图片链接，推送到草稿箱
"""

import requests
import json
import os
import sys

# ========== 配置 ==========
APP_ID = "wx3603c0e7f8984d82"
APP_SECRET = "3416d4a404ce19ffcf861cfef70b6a9a"

BASE_DIR = r"E:\WorkBuddy工作空间\DeepSeek-Harness\插件\dsh-0-tools-fix"
HTML_FILE = os.path.join(BASE_DIR, "article", "零号工具推荐文章.html")
COVER_FILE = os.path.join(BASE_DIR, "article", "cover.jpg")
SCREENSHOTS_DIR = os.path.join(BASE_DIR, "screenshots")

ARTICLE_TITLE = "零门槛零费用！14岁女生的GitHub处女作——手把手教你3分钟玩转DeepSeek Harness"
ARTICLE_AUTHOR = "钰婷（Yukin）"
ARTICLE_DIGEST = "14岁初中女生的GitHub处女作！一键安装DeepSeek Harness，一键配置智谱+OpenRouter双免费模型池，零门槛零费用开启AI编程之旅。"


def main():
    # ========== 1. 获取 access_token ==========
    print("=" * 50)
    print("[1/5] 获取 access_token")
    print("=" * 50)
    token_url = f"https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid={APP_ID}&secret={APP_SECRET}"
    resp = requests.get(token_url, timeout=15)
    token_data = resp.json()
    if "access_token" not in token_data:
        print(f"获取token失败: {token_data}")
        sys.exit(1)
    access_token = token_data["access_token"]
    print(f"✅ access_token 获取成功，有效期 {token_data['expires_in']} 秒")

    # ========== 2. 上传封面图为永久素材 ==========
    print()
    print("=" * 50)
    print("[2/5] 上传封面图为永久素材")
    print("=" * 50)
    cover_url = f"https://api.weixin.qq.com/cgi-bin/material/add_material?access_token={access_token}&type=image"
    with open(COVER_FILE, "rb") as f:
        files = {"media": ("cover.jpg", f, "image/jpeg")}
        resp = requests.post(cover_url, files=files, timeout=30)
    cover_data = resp.json()
    if "media_id" not in cover_data:
        print(f"封面图上传失败: {cover_data}")
        sys.exit(1)
    thumb_media_id = cover_data["media_id"]
    print(f"✅ 封面图上传成功，media_id: {thumb_media_id}")

    # ========== 3. 上传文章内5张截图 ==========
    print()
    print("=" * 50)
    print("[3/5] 上传文章内截图")
    print("=" * 50)
    image_url_map = {}
    upload_url = f"https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token={access_token}"

    for i in range(1, 6):
        img_file = os.path.join(SCREENSHOTS_DIR, f"{i}.png")
        if os.path.exists(img_file):
            with open(img_file, "rb") as f:
                files = {"media": (f"{i}.png", f, "image/png")}
                resp = requests.post(upload_url, files=files, timeout=30)
            img_data = resp.json()
            if "url" in img_data:
                wechat_url = img_data["url"]
                image_url_map[f"../screenshots/{i}.png"] = wechat_url
                image_url_map[f"screenshots/{i}.png"] = wechat_url
                print(f"✅ {i}.png 上传成功: {wechat_url[:60]}...")
            else:
                print(f"❌ {i}.png 上传失败: {img_data}")

    # ========== 4. 读取HTML并替换图片链接 ==========
    print()
    print("=" * 50)
    print("[4/5] 读取HTML并替换图片链接")
    print("=" * 50)
    with open(HTML_FILE, "r", encoding="utf-8") as f:
        html_content = f.read()

    for old_path, new_url in image_url_map.items():
        html_content = html_content.replace(old_path, new_url)

    print(f"✅ HTML内容读取并替换完成，长度: {len(html_content)} 字符")

    # ========== 5. 推送到草稿箱 ==========
    print()
    print("=" * 50)
    print("[5/5] 推送到草稿箱")
    print("=" * 50)
    draft_url = f"https://api.weixin.qq.com/cgi-bin/draft/add?access_token={access_token}"

    payload = {
        "articles": [
            {
                "title": ARTICLE_TITLE,
                "author": ARTICLE_AUTHOR,
                "digest": ARTICLE_DIGEST,
                "content": html_content,
                "content_source_url": "",
                "thumb_media_id": thumb_media_id,
                "need_open_comment": 1,
                "only_fans_can_comment": 0
            }
        ]
    }

    headers = {"Content-Type": "application/json; charset=utf-8"}
    resp = requests.post(draft_url, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), headers=headers, timeout=30)
    draft_data = resp.json()

    if "media_id" in draft_data:
        print()
        print("=" * 50)
        print("  🎉 草稿推送成功！")
        print(f"  草稿 media_id: {draft_data['media_id']}")
        print("=" * 50)
        print()
        print("请登录微信公众平台，在「内容管理」→「草稿箱」中查看和发布。")
    else:
        print(f"❌ 草稿推送失败: {draft_data}")
        sys.exit(1)


if __name__ == "__main__":
    main()
