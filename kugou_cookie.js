/* 酷狗概念版 - 独立获取 Cookie 脚本 */
const KEY_REQS = 'kg_concept_requests_v3';

if (typeof $request !== 'undefined') {
    let reqs = [];
    const saved = $persistentStore.read(KEY_REQS);
    if (saved) { try { reqs = JSON.parse(saved); } catch (e) {} }

    const url = $request.url;
    // 自动过滤掉网页、图片等无用请求，只抓核心数据接口
    if (!url.includes(".html") && !url.includes(".css") && !url.includes(".js") && !url.includes(".png") && !url.includes(".jpg")) {
        const exists = reqs.some(r => r.url === url);
        if (!exists) {
            if (reqs.length >= 5) reqs.shift(); // 最多存5个核心签到/领VIP接口
            reqs.push({
                url: url,
                headers: $request.headers || {},
                body: $request.body || '',
                method: $request.method || 'POST'
            });
            $persistentStore.write(JSON.stringify(reqs), KEY_REQS);
            
            // 解决问题1：只要抓到核心接口，必定弹窗明确提示！
            $notification.post("酷狗概念版", "🎉 获取 Cookie 成功", `已成功捕获核心签到凭证！(当前已保存 ${reqs.length} 个有效接口)`);
        }
    }
    $done({});
}
