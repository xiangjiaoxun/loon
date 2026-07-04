/*
酷狗概念版全自动签到脚本
*/
const KEY_REQS = 'kg_concept_requests';

if (typeof $request !== 'undefined') {
    // 自动抓取并存入签到数据
    captureRequest();
} else {
    // 定时自动全自动签到
    executeCheckIn();
}

function captureRequest() {
    let reqs = [];
    const saved = $persistentStore.read(KEY_REQS);
    if (saved) { try { reqs = JSON.parse(saved); } catch (e) {} }
    
    const exists = reqs.some(r => r.url === $request.url);
    if (!exists) {
        if (reqs.length >= 5) reqs.shift(); 
        reqs.push({
            url: $request.url,
            headers: $request.headers || {},
            body: $request.body || '',
            method: $request.method || 'POST'
        });
        $persistentStore.write(JSON.stringify(reqs), KEY_REQS);
        $notification.post("酷狗概念版", "📌 成功捕获签到数据", "后续将每天自动为您运行签到。");
    }
    $done({});
}

async function executeCheckIn() {
    const saved = $persistentStore.read(KEY_REQS);
    if (!saved) {
        $notification.post("酷狗概念版", "❌ 自动签到失败", "未找到捕获数据。请去App手动签到一次。");
        $done();
        return;
    }

    let reqs = [];
    try { reqs = JSON.parse(saved); } catch (e) { $done(); return; }

    let successCount = 0;
    let results = [];

    for (let i = 0; i < reqs.length; i++) {
        const req = reqs[i];
        await new Promise((resolve) => {
            const options = { url: req.url, headers: req.headers, body: req.body };
            const callback = (error, response, data) => {
                if (error) {
                    results.push(`任务${i+1}异常: ${error}`);
                } else {
                    successCount++;
                    try {
                        const res = JSON.parse(data);
                        results.push(`任务${i+1}: ${res.msg || res.message || '成功'}`);
                    } catch (e) {
                        results.push(`任务${i+1}: 签到请求已成功重放`);
                    }
                }
                resolve();
            };
            if (req.method.toUpperCase() === 'GET') {
                $httpClient.get(options, callback);
            } else {
                $httpClient.post(options, callback);
            }
        });
    }

    $notification.post("酷狗自动签到结果", `成功运行 ${successCount}/${reqs.length} 个签到任务`, results.join('\n'));
    $done();
}
